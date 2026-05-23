"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderKanban, LogOut, type LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/login/actions";

// AppSidebar — shadcn-sidebar-based, replacing the hand-rolled version.
// Two built nav items per decision 0017 (no dead links). collapsible="icon"
// so desktop users can collapse to a narrow icon strip; mobile renders as
// a Sheet via the SidebarTrigger in the inset header.

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  prefix?: string;
};

const NAV: readonly NavItem[] = [
  { href: "/cockpit", label: "Cockpit", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban, prefix: "/projects" },
];

export function AppSidebar({
  member,
}: {
  member: {
    fullName: string;
    avatarInitials: string | null;
    accessTier: string;
  };
}) {
  const pathname = usePathname();
  const initials = member.avatarInitials ?? deriveInitials(member.fullName);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[13px] font-medium tracking-wider text-accent-foreground"
            aria-hidden
          >
            B
          </span>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-medium">Backstage</span>
            <span className="truncate text-[10px] text-muted-foreground">
              SKAM studio
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = item.prefix
                  ? pathname === item.href ||
                    pathname.startsWith(`${item.prefix}/`)
                  : pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={`${member.fullName} · ${member.accessTier}`}
              className="cursor-default"
            >
              <span
                className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground"
                aria-hidden
              >
                {initials}
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-sidebar" />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[12px]">{member.fullName}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {member.accessTier}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton type="submit" tooltip="Sign out">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function deriveInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
