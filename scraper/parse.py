from __future__ import annotations

import re
from pathlib import Path

from bs4 import BeautifulSoup, Tag

from scraper.models import (
    CategoryMenu,
    LocationMenu,
    MealMenu,
    MenuItem,
    RecipeDetails,
)

DATE_CLASS_PATTERN = re.compile(r"^\d{8}$")
CARBON_FOOTPRINT_MAP = {
    "low.png": "low",
    "med.png": "medium",
    "high.png": "high",
}
NUTRITION_KEY_MAP = {
    "calories (kcal)": "calories_kcal",
    "total lipid/fat (g)": "total_fat_g",
    "saturated fatty acid (g)": "saturated_fat_g",
    "trans fat (g)": "trans_fat_g",
    "cholesterol (mg)": "cholesterol_mg",
    "sodium (mg)": "sodium_mg",
    "carbohydrate (g)": "carbohydrate_g",
    "total dietary fiber (g)": "fiber_g",
    "sugar (g)": "sugar_g",
    "protein (g)": "protein_g",
    "vitamin a (iu)": "vitamin_a_iu",
    "vitamin c (mg)": "vitamin_c_mg",
    "calcium (mg)": "calcium_mg",
    "iron (mg)": "iron_mg",
    "water (g)": "water_g",
    "ash (g)": "ash_g",
    "vitamin a (rae)": "vitamin_a_rae",
    "potassium (mg)": "potassium_mg",
    "vitamin d(iu)": "vitamin_d_iu",
    "carbon footprint (kg co2)": "carbon_footprint_kg_co2",
}


def parse_menu_html(html: str) -> list[LocationMenu]:
    """Parse menu HTML into a list of location menus."""
    soup = BeautifulSoup(html, "lxml")
    locations: list[LocationMenu] = []

    for location_el in soup.select("li.location-name"):
        locations.append(_parse_location(location_el))

    return locations


def parse_menu_html_file(path: Path | str) -> list[LocationMenu]:
    """Parse menu HTML from a saved page or fragment file."""
    content = Path(path).read_text(encoding="utf-8")
    soup = BeautifulSoup(content, "lxml")
    cafe_wrap = soup.select_one(".cafe-wrap")
    if cafe_wrap is not None:
        content = str(cafe_wrap)
    return parse_menu_html(content)


def _parse_location(location_el: Tag) -> LocationMenu:
    classes = location_el.get("class", [])
    slug = _slug_from_location_classes(classes)
    title_el = location_el.select_one(".cafe-title")
    status_el = location_el.select_one(".status")
    serve_date_el = location_el.select_one(".serve-date")
    hours = [
        span.get_text(strip=True)
        for span in location_el.select(".times span")
        if span.get_text(strip=True)
    ]

    meals: list[MealMenu] = []
    for meal_el in location_el.select("li.preiod-name"):
        meals.append(_parse_meal(meal_el))

    return LocationMenu(
        slug=slug,
        name=title_el.get_text(strip=True) if title_el else slug,
        status=status_el.get_text(strip=True) if status_el else "",
        hours=hours,
        serve_date=serve_date_el.get_text(strip=True) if serve_date_el else "",
        meals=meals,
    )


def _slug_from_location_classes(classes: list[str]) -> str:
    tokens = [token for token in classes if token != "location-name"]
    if not tokens:
        return ""

    if DATE_CLASS_PATTERN.match(tokens[-1]):
        tokens = tokens[:-1]

    return "_".join(tokens)


def _parse_meal(meal_el: Tag) -> MealMenu:
    period = _meal_period_from_element(meal_el)
    categories: list[CategoryMenu] = []

    for category_el in meal_el.select(".recipes-main-wrap .cat-name"):
        categories.append(_parse_category(category_el))

    return MealMenu(period=period, categories=categories)


def _meal_period_from_element(meal_el: Tag) -> str:
    classes = meal_el.get("class", [])
    if "preiod-name" in classes:
        idx = classes.index("preiod-name")
        remainder = classes[idx + 1 :]
        if remainder:
            if DATE_CLASS_PATTERN.match(remainder[-1]):
                remainder = remainder[:-1]
            if remainder:
                return " ".join(remainder)

    label = meal_el.find("span", recursive=False)
    if label:
        text = label.get_text(" ", strip=True)
        text = text.replace("\u00a0", " ")
        return re.sub(r"\s+", " ", text).strip()

    return ""


def _parse_category(category_el: Tag) -> CategoryMenu:
    name_el = category_el.find("span", recursive=False)
    name = name_el.get_text(strip=True) if name_el else ""
    items = [_parse_item(item_el) for item_el in category_el.select("li.recip")]
    return CategoryMenu(name=name, items=items)


def _parse_item(item_el: Tag) -> MenuItem:
    name_span = item_el.find("span", recursive=False)
    name = name_span.get_text(strip=True) if name_span else item_el.get_text(strip=True)
    tags = [cls for cls in item_el.get("class", []) if cls != "recip"]

    return MenuItem(
        id=item_el.get("data-id", ""),
        menu_id=item_el.get("data-menuid", ""),
        name=name,
        tags=tags,
        carbon_footprint=_carbon_footprint_from_item(item_el),
        data_location=item_el.get("data-location", ""),
    )


def _carbon_footprint_from_item(item_el: Tag) -> str | None:
    for img in item_el.select("img[src*='green_image/']"):
        src = img.get("src", "")
        for suffix, label in CARBON_FOOTPRINT_MAP.items():
            if suffix in src:
                return label
        alt = img.get("alt", "").lower()
        tooltip = img.find_next("span", class_="allg-tooltip")
        tooltip_text = tooltip.get_text(strip=True).lower() if tooltip else ""
        combined = f"{alt} {tooltip_text}"
        if "high" in combined:
            return "high"
        if "medium" in combined or "med" in combined:
            return "medium"
        if "low" in combined:
            return "low"
    return None


def parse_recipe_details(html: str) -> RecipeDetails:
    """Parse nutrition, ingredients, and allergens from recipe detail HTML."""
    soup = BeautifulSoup(html, "lxml")
    serving_el = soup.select_one(".serving-size")
    serving_size = None
    if serving_el:
        serving_text = serving_el.get_text(" ", strip=True)
        serving_size = serving_text.replace("Serving Size:", "", 1).strip()

    nutrition: dict[str, float | str] = {}
    for row in soup.select(".nutration-details li"):
        label_el = row.find("span")
        if not label_el:
            continue
        label = label_el.get_text(strip=True).rstrip(":").lower()
        value_text = row.get_text(" ", strip=True)
        value_text = value_text.replace(label_el.get_text(strip=True), "", 1).strip()
        key = NUTRITION_KEY_MAP.get(label, _normalize_nutrition_key(label))
        nutrition[key] = _parse_nutrition_value(value_text)

    ingredients_el = soup.select_one(".ingredients .content")
    ingredients = ingredients_el.get_text(" ", strip=True) if ingredients_el else None

    allergens = [
        span.get_text(strip=True)
        for span in soup.select(".allergens span")
        if span.get_text(strip=True)
    ]

    return RecipeDetails(
        serving_size=serving_size,
        nutrition=nutrition,
        ingredients=ingredients,
        allergens=allergens,
    )


def _normalize_nutrition_key(label: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
    return normalized


def _parse_nutrition_value(value_text: str) -> float | str:
    value_text = value_text.strip()
    try:
        return float(value_text)
    except ValueError:
        return value_text
