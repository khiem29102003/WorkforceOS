"use client";

import { LogOut, Moon, Settings, Sun, UserCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@ewos/ui";

export function UserDropdown({ userName, userEmail }: { userName: string; userEmail: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const ThemeIcon = resolvedTheme === "dark" ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 px-2" aria-label="Open user menu">
          <UserCircle className="h-5 w-5" aria-hidden />
          <span className="hidden max-w-40 truncate sm:inline">{userName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(nextTheme)}>
          <ThemeIcon className="mr-2 h-4 w-4" aria-hidden />
          Toggle theme
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" aria-hidden />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

