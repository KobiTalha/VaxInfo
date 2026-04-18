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

  const preference = await prisma.userDashboardPreference.findUnique({
    where: {
      userId
    }
  });

  return NextResponse.json({ preference }, { status: 200 });
}

type PreferenceBody = {
  preferredRegion?: string | null;
};

export async function PUT(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  let payload: PreferenceBody;

  try {
    payload = (await request.json()) as PreferenceBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const preferredRegion = payload.preferredRegion?.trim() || null;

  const preference = await prisma.userDashboardPreference.upsert({
    where: {
      userId
    },
    update: {
      preferredRegion
    },
    create: {
      userId,
      preferredRegion
    }
  });

  return NextResponse.json({ preference }, { status: 200 });
}
