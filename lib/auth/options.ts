// @ts-nocheck
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types/roles";
import bcrypt from "bcryptjs";
import { isDemoEmail, triggerDemoReset } from "@/lib/demo/reset";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user?.password) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        // Demo accounts: fire-and-forget reset in background so next visitor
        // starts with clean data. Login is NOT blocked — reset runs async.
        if (isDemoEmail(credentials.email)) {
          triggerDemoReset();
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),

  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      // Always re-fetch from DB so role/businessId are always current
      const emailToLookup = user?.email ?? (token.email as string | undefined);
      if (emailToLookup) {
        const dbUser = await prisma.user.findUnique({
          where: { email: emailToLookup },
          select: { role: true, id: true, businessId: true },
        });
        if (dbUser) {
          token.role = dbUser.role ?? UserRole.MANAGER;
          token.id = dbUser.id;
          token.businessId = dbUser.businessId ?? null;
        }
      }
      if (user && !token.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.businessId = token.businessId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",

  },
  secret: process.env.NEXTAUTH_SECRET,
};
