import { BarChart3, Bot, CalendarCheck, ClipboardList, ShieldCheck, Users } from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: BarChart3, href: "/" },
  { label: "Employees", icon: Users, href: "/employees" },
  { label: "Leave", icon: CalendarCheck, href: "/leave" },
  { label: "Rules", icon: ClipboardList, href: "/rules" },
  { label: "AI Insights", icon: Bot, href: "/ai" },
  { label: "Audit", icon: ShieldCheck, href: "/audit" }
] as const;

export function Sidebar() {
  return (
    <aside className="hidden border-r bg-secondary/40 lg:block">
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground" aria-hidden>
          OS
        </div>
        <span className="ml-3 font-semibold">Workforce OS</span>
      </div>
      <nav className="p-3" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <a key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground">
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

