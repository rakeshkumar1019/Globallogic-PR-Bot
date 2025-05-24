"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  GitPullRequest,
  Home,
  Settings,
  GitBranch,
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
  const { data: session } = useSession()

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
      logo: GitPullRequest,
      plan: "Intelligent PR Assistant",
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
      title: "Pull Requests",
              url: "/pull-request",
      icon: GitPullRequest,
    },
    {
      title: "Repositories",
      url: "/repositories",
      icon: GitBranch,
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
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
