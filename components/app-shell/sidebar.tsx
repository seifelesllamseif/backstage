'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  UserRound,
  type LucideIcon
} from 'lucide-react'
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
  SidebarRail
} from '@/components/ui/sidebar'
import { signOut } from '@/app/login/actions'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  prefix?: string
}

const NAV: readonly NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    prefix: '/dashboard'
  },
  { href: '/cockpit', label: 'Cockpit', icon: Home },
  {
    href: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    prefix: '/projects'
  },
  {
    href: '/portfolio',
    label: 'Portfolio',
    icon: UserRound,
    prefix: '/portfolio'
  }
]

export function AppSidebar({
  member
}: {
  member: {
    fullName: string
    avatarInitials: string | null
    accessTier: string
  }
}) {
  const pathname = usePathname()
  const initials = member.avatarInitials ?? deriveInitials(member.fullName)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span
            className="bg-accent text-accent-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[13px] font-medium tracking-wider"
            aria-hidden
          >
            B
          </span>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-medium">Backstage</span>
            <span className="text-muted-foreground truncate text-[10px]">
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
                const Icon = item.icon
                const active = item.prefix
                  ? pathname === item.href ||
                    pathname.startsWith(`${item.prefix}/`)
                  : pathname === item.href
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
                )
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
                className="bg-muted text-muted-foreground relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-medium"
                aria-hidden
              >
                {initials}
                <span className="bg-accent ring-sidebar absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2" />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[12px]">{member.fullName}</span>
                <span className="text-muted-foreground truncate text-[10px]">
                  {member.accessTier}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton asChild tooltip="Sign out">
                <button type="submit">
                  <LogOut />
                  <span>Sign out</span>
                </button>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function deriveInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
