import { prisma } from "@/lib/prisma";
import Fuse from "fuse.js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("disease")?.trim();

  if (!query) {
    return NextResponse.json(
      { message: "Missing required query parameter: disease" },
      { status: 400 }
    );
  }

  try {
    const diseases = await prisma.disease.findMany({
      include: {
        vaccines: true
      }
    });

    const lowerQuery = query.toLowerCase();

    let matchedDisease = diseases.find((disease) => disease.name.toLowerCase() === lowerQuery);
    let matchType: "exact" | "alias" | "fuzzy" = "exact";
    let score: number | null = null;

    if (!matchedDisease) {
      matchedDisease = diseases.find((disease) =>
        disease.aliases.some((alias) => alias.toLowerCase() === lowerQuery)
      );

      if (matchedDisease) {
        matchType = "alias";
        score = 0;
      }
    }

    if (!matchedDisease) {
      const fuse = new Fuse(diseases, {
        keys: ["name", "aliases"],
        includeScore: true,
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2
      });

      const best = fuse.search(query, { limit: 1 })[0];
      if (best) {
        matchedDisease = best.item;
        matchType = "fuzzy";
        score = best.score ?? null;
      }
    }

    if (!matchedDisease) {
      return NextResponse.json(
        { message: "Disease not found in database" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        disease: matchedDisease.name,
        vaccines: matchedDisease.vaccines.map((vaccine) => vaccine.name),
        matchType,
        score
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Search API failed", error);
    return NextResponse.json(
      { message: "Unable to process search request." },
      { status: 500 }
    );
  }
}
