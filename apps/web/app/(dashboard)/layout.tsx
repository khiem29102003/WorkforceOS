import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { UserDropdown } from "@/components/dashboard/user-dropdown";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
            <div>
              <p className="text-sm text-muted-foreground">Enterprise Workforce OS</p>
              <h1 className="text-lg font-semibold">Operations Dashboard</h1>
            </div>
            <UserDropdown userName={session?.user?.name ?? "Demo User"} userEmail={session?.user?.email ?? "admin@demo.com"} />
          </header>
          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
