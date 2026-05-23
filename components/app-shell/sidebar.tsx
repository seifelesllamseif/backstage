"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderKanban, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import { PersonChip } from "@/components/ui/person-chip";

// Persistent left sidebar. Ported from design/app-shell.jsx with only the
// built nav items per decision 0017. Crew / Knowledge / Vault entries are
// intentionally absent — those features don't exist yet.

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match this prefix as well as the exact href. */
  prefix?: string;
};

const NAV: readonly NavItem[] = [
  { href: "/cockpit", label: "Cockpit", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban, prefix: "/projects" },
];

export function Sidebar({
  member,
}: {
  member: {
    fullName: string;
    avatarInitials: string | null;
    accessTier: string;
  };
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[13px] font-medium tracking-wider text-accent-foreground"
          aria-hidden
        >
          B
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-medium">Backstage</span>
          <span className="text-[10px] text-muted-foreground">SKAM studio</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.prefix
              ? pathname === item.href || pathname.startsWith(`${item.prefix}/`)
              : pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-divider px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <PersonChip
            name={member.fullName}
            initials={member.avatarInitials ?? undefined}
            size="md"
            self
          />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              Sign out
            </button>
          </form>
        </div>
        <p className="mt-1.5 pl-8 text-[10px] text-muted-foreground">
          {member.accessTier}
        </p>
      </div>
    </aside>
  );
}
