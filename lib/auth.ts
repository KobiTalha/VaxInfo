import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/server/password";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createHash } from "node:crypto";

function verifyLegacySha256(password: string, hash: string) {
  const computed = createHash("sha256").update(password).digest("hex");
  return computed === hash;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database"
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email
          }
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isScryptFormat = user.passwordHash.includes(":");
        const isValid = isScryptFormat
          ? verifyPassword(password, user.passwordHash)
          : verifyLegacySha256(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: string }).role ?? "user";
      }

      return session;
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
};

export async function getAuthSession() {
  try {
    return await getServerSession(authOptions);
  } catch {
    // If auth config or adapter access fails, treat request as anonymous.
    return null;
  }
}
