import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      accessToken: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    tenantId?: string;
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string;
    accessToken?: string;
  }
}

