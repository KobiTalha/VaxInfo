import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const chats = await prisma.chatSession.findMany({
    where: {
      userId
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 25
  });

  return NextResponse.json({ chats }, { status: 200 });
}
