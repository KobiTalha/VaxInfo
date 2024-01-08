import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const diseases = await prisma.disease.findMany({
      include: {
        vaccines: true
      },
      orderBy: {
        name: "asc"
      }
    });

    const enriched = diseases.map((disease) => ({
      ...disease,
      hasVaccine: disease.vaccines.length > 0
    }));

    return NextResponse.json({ diseases: enriched }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch vaccine data", error);
    return NextResponse.json(
      { message: "Unable to fetch vaccine dataset." },
      { status: 500 }
    );
  }
}
