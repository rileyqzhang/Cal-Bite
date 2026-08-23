import { NextRequest, NextResponse } from "next/server";
import { filterFoodNames, listUniqueFoodNames } from "@/lib/favorites/foods";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const foods = await listUniqueFoodNames();
    if (!q) {
      return NextResponse.json({ foods, query: q });
    }
    return NextResponse.json({
      foods: filterFoodNames(foods, q),
      query: q,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list foods" },
      { status: 500 },
    );
  }
}
