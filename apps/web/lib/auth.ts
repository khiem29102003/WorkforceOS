import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }
        const response = await fetch(`${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000"}/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data)
        });
        if (!response.ok) {
          return null;
        }
        const result = (await response.json()) as {
          user: { id: string; email: string; name: string; tenantId: string; accessToken: string };
        };
        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          tenantId: result.user.tenantId,
          accessToken: result.user.accessToken
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token["tenantId"] = "tenantId" in user && typeof user["tenantId"] === "string" ? user["tenantId"] : undefined;
        token["accessToken"] = "accessToken" in user && typeof user["accessToken"] === "string" ? user["accessToken"] : undefined;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.tenantId = typeof token["tenantId"] === "string" ? token["tenantId"] : "";
      session.user.accessToken = typeof token["accessToken"] === "string" ? token["accessToken"] : "";
      return session;
    }
  }
});
