import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function requireUserId() {
  const session = await getAuthSession();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const savedDiseases = await prisma.savedDisease.findMany({
    where: {
      userId
    },
    include: {
      disease: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json({ savedDiseases }, { status: 200 });
}

type SaveDiseaseBody = {
  diseaseId?: number;
};

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  let payload: SaveDiseaseBody;

  try {
    payload = (await request.json()) as SaveDiseaseBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const diseaseId = Number(payload.diseaseId);
  if (!Number.isInteger(diseaseId) || diseaseId <= 0) {
    return NextResponse.json({ message: "Valid diseaseId is required." }, { status: 400 });
  }

  const saved = await prisma.savedDisease.upsert({
    where: {
      userId_diseaseId: {
        userId,
        diseaseId
      }
    },
    update: {},
    create: {
      userId,
      diseaseId
    },
    include: {
      disease: true
    }
  });

  return NextResponse.json({ saved }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const diseaseId = Number(request.nextUrl.searchParams.get("diseaseId") ?? "");
  if (!Number.isInteger(diseaseId) || diseaseId <= 0) {
    return NextResponse.json({ message: "Valid diseaseId query parameter is required." }, { status: 400 });
  }

  await prisma.savedDisease.deleteMany({
    where: {
      userId,
      diseaseId
    }
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
