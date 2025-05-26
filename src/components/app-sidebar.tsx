"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  Home,
  Settings,
  Bot,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session, status } = useSession()

  // Dynamic user data from session
  const userData = {
    name: session?.user?.name || "User",
    email: session?.user?.email || "user@example.com",
    avatar: session?.user?.image || "/avatars/default.jpg",
  }

  // Teams/Organizations - for PR review context
  const teams = [
    {
      name: "PR.AI",
      logo: Bot,
      plan: "by Velocity AI",
    },
  ]

  // Main navigation items - direct links without dropdowns
  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
      isActive: true,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} isLoading={status === 'loading'} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
