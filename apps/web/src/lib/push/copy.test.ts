import assert from "node:assert/strict";
import { test } from "node:test";
import type { FavoriteMatch } from "@berkeley-dining/shared";
import {
  buildDailyDigestCopy,
  shortMealLabel,
  uniqueFavoriteNames,
} from "./copy";

function match(overrides: Partial<FavoriteMatch> = {}): FavoriteMatch {
  return {
    food_name: "Orange Chicken",
    item_id: "1",
    location_name: "Crossroads",
    location_slug: "crossroads",
    meal_period: "Summer - Lunch",
    category: "Entrees",
    tags: [],
    ...overrides,
  };
}

test("uniqueFavoriteNames keeps first display spelling", () => {
  assert.deepEqual(
    uniqueFavoriteNames([
      match({ food_name: "Orange Chicken" }),
      match({ food_name: "orange chicken", location_name: "Cafe 3" }),
      match({ food_name: "Potato Wedges" }),
    ]),
    ["Orange Chicken", "Potato Wedges"],
  );
});

test("shortMealLabel uses the last period segment", () => {
  assert.equal(shortMealLabel("Summer - Breakfast"), "Breakfast");
  assert.equal(shortMealLabel("Lunch"), "Lunch");
});

test("one favorite uses singular count copy", () => {
  assert.deepEqual(buildDailyDigestCopy([match()], "favorites_only"), {
    title: "Favorites today",
    body: "Good morning! You have 1 favorite food today 🍳",
    matchCount: 1,
  });
});

test("two favorites use plural count copy", () => {
  assert.deepEqual(
    buildDailyDigestCopy(
      [match(), match({ food_name: "Potato Wedges" })],
      "favorites_only",
    ),
    {
      title: "Favorites today",
      body: "Good morning! You have 2 favorite foods today 🍳",
      matchCount: 2,
    },
  );
});

test("three favorites use plural count copy", () => {
  assert.deepEqual(
    buildDailyDigestCopy(
      [
        match(),
        match({ food_name: "Potato Wedges" }),
        match({ food_name: "Scrambled Eggs" }),
      ],
      "favorites_only",
    ),
    {
      title: "Favorites today",
      body: "Good morning! You have 3 favorite foods today 🍳",
      matchCount: 3,
    },
  );
});

test("duplicate names across halls count once", () => {
  assert.deepEqual(
    buildDailyDigestCopy(
      [
        match(),
        match({ food_name: "orange chicken", location_name: "Cafe 3" }),
        match({ food_name: "Potato Wedges" }),
      ],
      "favorites_only",
    ),
    {
      title: "Favorites today",
      body: "Good morning! You have 2 favorite foods today 🍳",
      matchCount: 2,
    },
  );
});

test("always mode sends zero-favorites morning copy", () => {
  assert.deepEqual(buildDailyDigestCopy([], "always"), {
    title: "CalBite",
    body: "Good morning! You don't have any favorite foods scheduled today.",
    matchCount: 0,
  });
});

test("favorites-only mode stays silent when there are no matches", () => {
  assert.equal(buildDailyDigestCopy([], "favorites_only"), null);
});
