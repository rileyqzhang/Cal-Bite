from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any


@dataclass
class MenuItem:
    id: str
    menu_id: str
    name: str
    tags: list[str] = field(default_factory=list)
    carbon_footprint: str | None = None
    data_location: str = ""
    nutrition: dict[str, Any] | None = None
    ingredients: str | None = None
    allergens: list[str] = field(default_factory=list)


@dataclass
class CategoryMenu:
    name: str
    items: list[MenuItem] = field(default_factory=list)


@dataclass
class MealMenu:
    period: str
    categories: list[CategoryMenu] = field(default_factory=list)


@dataclass
class LocationMenu:
    slug: str
    name: str
    status: str
    hours: list[str] = field(default_factory=list)
    serve_date: str = ""
    meals: list[MealMenu] = field(default_factory=list)


@dataclass
class RecipeDetails:
    serving_size: str | None = None
    nutrition: dict[str, Any] = field(default_factory=dict)
    ingredients: str | None = None
    allergens: list[str] = field(default_factory=list)


def menu_item_to_dict(item: MenuItem) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": item.id,
        "menu_id": item.menu_id,
        "name": item.name,
        "tags": item.tags,
    }
    if item.carbon_footprint:
        data["carbon_footprint"] = item.carbon_footprint
    if item.nutrition is not None:
        data["nutrition"] = item.nutrition
    if item.ingredients is not None:
        data["ingredients"] = item.ingredients
    if item.allergens:
        data["allergens"] = item.allergens
    return data


def location_menu_to_dict(location: LocationMenu) -> dict[str, Any]:
    return {
        "slug": location.slug,
        "name": location.name,
        "status": location.status,
        "hours": location.hours,
        "serve_date": location.serve_date,
        "meals": [
            {
                "period": meal.period,
                "categories": [
                    {
                        "name": category.name,
                        "items": [menu_item_to_dict(item) for item in category.items],
                    }
                    for category in meal.categories
                ],
            }
            for meal in location.meals
        ],
    }


def build_output(
    menu_date: date,
    locations: list[LocationMenu],
    scraped_at: datetime | None = None,
) -> dict[str, Any]:
    scraped_at = scraped_at or datetime.now().astimezone()
    return {
        "date": menu_date.isoformat(),
        "scraped_at": scraped_at.isoformat(),
        "locations": [location_menu_to_dict(location) for location in locations],
    }


def dataclass_to_dict(obj: Any) -> Any:
    if hasattr(obj, "__dataclass_fields__"):
        return asdict(obj)
    return obj
