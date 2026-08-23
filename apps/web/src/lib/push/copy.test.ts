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

test("one favorite includes hall and meal", () => {
  assert.deepEqual(buildDailyDigestCopy([match()], "favorites_only"), {
    title: "Orange Chicken is on the menu",
    body: "Crossroads · Lunch. Decide if you’re going.",
    matchCount: 1,
  });
});

test("one favorite falls back when hall and meal are missing", () => {
  assert.deepEqual(
    buildDailyDigestCopy(
      [match({ location_name: "", meal_period: "" })],
      "always",
    ),
    {
      title: "Orange Chicken is on the menu",
      body: "Decide if you’re going.",
      matchCount: 1,
    },
  );
});

test("two favorites name both foods", () => {
  assert.deepEqual(
    buildDailyDigestCopy(
      [match(), match({ food_name: "Potato Wedges" })],
      "favorites_only",
    ),
    {
      title: "2 favorites today",
      body: "Orange Chicken and Potato Wedges. Plan your meal before you go.",
      matchCount: 2,
    },
  );
});

test("three favorites list all names", () => {
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
      title: "3 favorites today",
      body: "Orange Chicken, Potato Wedges, and Scrambled Eggs. Plan your meal before you go.",
      matchCount: 3,
    },
  );
});

test("four or more favorites name only the first", () => {
  assert.deepEqual(
    buildDailyDigestCopy(
      [
        match(),
        match({ food_name: "Potato Wedges" }),
        match({ food_name: "Scrambled Eggs" }),
        match({ food_name: "Mung Bean Patty" }),
        match({ food_name: "Roasted Broccoli" }),
        match({ food_name: "Turkey Sausage Patty" }),
      ],
      "favorites_only",
    ),
    {
      title: "6 favorites today",
      body: "Including Orange Chicken. Plan your meal before you go.",
      matchCount: 6,
    },
  );
});

test("always mode sends a menu teaser when there are no matches", () => {
  assert.deepEqual(buildDailyDigestCopy([], "always"), {
    title: "Today’s menu is up",
    body: "See what’s being served and decide if you’re going.",
    matchCount: 0,
  });
});

test("favorites-only mode stays silent when there are no matches", () => {
  assert.equal(buildDailyDigestCopy([], "favorites_only"), null);
});
