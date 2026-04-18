import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/server/password";
import { NextResponse } from "next/server";

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  let payload: RegisterBody;

  try {
    payload = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password ?? "";
  const name = payload.name?.trim() || null;

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { message: "Email and password (min 8 chars) are required." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: {
      email
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return NextResponse.json({ message: "User already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hashPassword(password),
      dashboardPreference: {
        create: {
          preferredRegion: "Global"
        }
      }
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });

  return NextResponse.json({ user }, { status: 201 });
}
