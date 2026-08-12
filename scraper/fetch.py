from __future__ import annotations

import re
from datetime import date

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

AJAX_URL = "https://dining.berkeley.edu/wp-admin/admin-ajax.php"
MENUS_URL = "https://dining.berkeley.edu/menus/"
USER_AGENT = "BerkeleyMenuScraper/1.0 (+local research tool)"
EMPTY_MENU_MARKER = '<ul class="cafe-location"></ul>'
NO_MENU_MESSAGE = "We are currently working on the menu"

DEFAULT_TIMEOUT = 30
MAX_RETRIES = 3
RECIPE_CONCURRENCY = 8


class MenuFetchError(RuntimeError):
    pass


class RecipeCache:
    def __init__(self) -> None:
        self._cache: dict[tuple[str, str, str], str] = {}

    def get(self, location_b64: str, recipe_id: str, menu_id: str) -> str | None:
        return self._cache.get((location_b64, recipe_id, menu_id))

    def set(self, location_b64: str, recipe_id: str, menu_id: str, html: str) -> None:
        self._cache[(location_b64, recipe_id, menu_id)] = html


def _build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("POST",),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def format_menu_date(menu_date: date) -> str:
    return menu_date.strftime("%Y%m%d")


def fetch_available_dates(
    *,
    session: requests.Session | None = None,
) -> list[date]:
    """Parse available menu dates from the live /menus/ page dropdown."""
    owns_session = session is None
    session = session or _build_session()
    try:
        response = session.get(MENUS_URL, timeout=DEFAULT_TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise MenuFetchError(f"Failed to fetch menus page: {exc}") from exc
    finally:
        if owns_session:
            session.close()

    soup = BeautifulSoup(response.text, "lxml")
    date_select = soup.find("select", id="date")
    if date_select is None:
        raise MenuFetchError("Date dropdown not found on menus page")

    dates: list[date] = []
    for option in date_select.find_all("option"):
        value = option.get("value", "")
        if re.fullmatch(r"\d{8}", value):
            dates.append(date(int(value[:4]), int(value[4:6]), int(value[6:8])))

    if not dates:
        raise MenuFetchError("No selectable dates found on menus page")

    return sorted(dates)


def fetch_available_dates_from_today(
    *,
    session: requests.Session | None = None,
) -> list[date]:
    today = date.today()
    return [menu_date for menu_date in fetch_available_dates(session=session) if menu_date >= today]


def fetch_menu_html(
    menu_date: date,
    location: str = "",
    meal: str = "",
    *,
    session: requests.Session | None = None,
) -> str:
    """Fetch menu HTML for a date via the cal-dining AJAX endpoint."""
    owns_session = session is None
    session = session or _build_session()
    try:
        response = session.post(
            AJAX_URL,
            data={
                "action": "cald_filter_xml",
                "location": location,
                "mealperiod": meal,
                "date": format_menu_date(menu_date),
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise MenuFetchError(f"Failed to fetch menu HTML: {exc}") from exc
    finally:
        if owns_session:
            session.close()

    html = response.text
    if EMPTY_MENU_MARKER in html:
        return NO_MENU_MESSAGE
    return html


def fetch_recipe_details_html(
    location_b64: str,
    recipe_id: str,
    menu_id: str,
    *,
    session: requests.Session | None = None,
    cache: RecipeCache | None = None,
) -> str:
    """Fetch raw nutrition HTML for a recipe."""
    if cache is not None:
        cached = cache.get(location_b64, recipe_id, menu_id)
        if cached is not None:
            return cached

    owns_session = session is None
    session = session or _build_session()
    try:
        response = session.post(
            AJAX_URL,
            data={
                "action": "get_recipe_details",
                "location": location_b64,
                "id": recipe_id,
                "menu_id": menu_id,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        html = response.text
    except requests.RequestException as exc:
        raise MenuFetchError(
            f"Failed to fetch recipe details for id={recipe_id}: {exc}"
        ) from exc
    finally:
        if owns_session:
            session.close()

    if cache is not None:
        cache.set(location_b64, recipe_id, menu_id, html)
    return html


def _recipe_cache_key(item) -> tuple[str, str, str]:
    return (item.data_location, item.id, item.menu_id)


def scrape_menus(
    menu_date: date,
    *,
    include_nutrition: bool = True,
    location: str = "",
    meal: str = "",
) -> dict:
    """Fetch, parse, optionally enrich, and return menu data as a JSON-ready dict."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    from scraper.models import MenuItem, build_output
    from scraper.parse import parse_menu_html, parse_recipe_details

    session = _build_session()
    recipe_cache = RecipeCache()

    try:
        html = fetch_menu_html(
            menu_date,
            location=location,
            meal=meal,
            session=session,
        )
        if html == NO_MENU_MESSAGE:
            return build_output(menu_date, [])

        locations = parse_menu_html(html)
        if not include_nutrition:
            return build_output(menu_date, locations)

        items_by_key: dict[tuple[str, str, str], MenuItem] = {}
        for location_menu in locations:
            for meal_menu in location_menu.meals:
                for category in meal_menu.categories:
                    for item in category.items:
                        items_by_key[_recipe_cache_key(item)] = item

        def enrich_item(key: tuple[str, str, str, MenuItem]) -> None:
            location_b64, recipe_id, menu_id, item = key
            html = fetch_recipe_details_html(
                location_b64,
                recipe_id,
                menu_id,
                session=session,
                cache=recipe_cache,
            )
            details = parse_recipe_details(html)
            nutrition = dict(details.nutrition)
            if details.serving_size:
                nutrition["serving_size"] = details.serving_size
            item.nutrition = nutrition or None
            item.ingredients = details.ingredients
            item.allergens = details.allergens

        work = [
            (item.data_location, item.id, item.menu_id, item)
            for item in items_by_key.values()
            if item.data_location and item.id and item.menu_id
        ]

        if work:
            with ThreadPoolExecutor(max_workers=RECIPE_CONCURRENCY) as executor:
                futures = [executor.submit(enrich_item, job) for job in work]
                for future in as_completed(futures):
                    future.result()

        return build_output(menu_date, locations)
    finally:
        session.close()
