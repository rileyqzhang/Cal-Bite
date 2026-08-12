from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from scraper.fetch import (
    fetch_available_dates_from_today,
    fetch_menu_html,
    fetch_recipe_details_html,
    scrape_menus,
)


def parse_date(value: str) -> date:
    if value.lower() == "today":
        return date.today()
    return date.fromisoformat(value)


def default_output_path(menu_date: date, output_dir: Path) -> Path:
    return output_dir / f"menus_{menu_date.isoformat()}.json"


def save_menus(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape Berkeley Dining menus into JSON."
    )
    parser.add_argument(
        "--date",
        default="today",
        help="Menu date as YYYY-MM-DD or 'today' (default: today)",
    )
    parser.add_argument(
        "--from",
        dest="from_date",
        help="Start date for backfill range (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--to",
        dest="to_date",
        help="End date for backfill range (YYYY-MM-DD, inclusive)",
    )
    parser.add_argument(
        "--location",
        default="",
        help="Optional location slug filter (e.g. Crossroads)",
    )
    parser.add_argument(
        "--meal",
        default="",
        help="Optional meal period filter (e.g. 'Summer - Lunch')",
    )
    parser.add_argument(
        "--no-nutrition",
        action="store_true",
        help="Skip recipe detail / nutrition enrichment",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("output"),
        help="Directory for JSON output (default: output/)",
    )
    parser.add_argument(
        "--through-available",
        action="store_true",
        help="Scrape today through the latest date on the live menus page",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Explicit output file path (only valid for single-date scrape)",
    )
    return parser


def iter_dates(from_date: date, to_date: date):
    current = from_date
    while current <= to_date:
        yield current
        current += timedelta(days=1)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.output and (args.from_date or args.to_date or args.through_available):
        parser.error("--output cannot be used with --from/--to or --through-available")

    if args.through_available and (args.from_date or args.to_date):
        parser.error("--through-available cannot be combined with --from/--to")

    if args.through_available:
        dates = fetch_available_dates_from_today()
    elif args.from_date or args.to_date:
        if not args.from_date or not args.to_date:
            parser.error("Both --from and --to are required for a date range")
        from_date = parse_date(args.from_date)
        to_date = parse_date(args.to_date)
        if to_date < from_date:
            parser.error("--to must be on or after --from")
        dates = list(iter_dates(from_date, to_date))
    else:
        dates = [parse_date(args.date)]

    for menu_date in dates:
        print(f"Scraping menus for {menu_date.isoformat()}...", file=sys.stderr)
        data = scrape_menus(
            menu_date,
            include_nutrition=not args.no_nutrition,
            location=args.location,
            meal=args.meal,
        )
        output_path = args.output or default_output_path(menu_date, args.output_dir)
        save_menus(data, output_path)
        location_count = len(data.get("locations", []))
        item_count = sum(
            len(category["items"])
            for location in data.get("locations", [])
            for meal in location.get("meals", [])
            for category in meal.get("categories", [])
        )
        print(
            f"Wrote {output_path} ({location_count} locations, {item_count} items)",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
