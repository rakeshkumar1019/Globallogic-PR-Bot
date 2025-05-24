"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bot } from "lucide-react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}) {
  const router = useRouter()
  const activeTeam = teams[0]

  if (!activeTeam) {
    return null
  }

  const handleLogoClick = () => {
    router.push('/')
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton 
          size="lg" 
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={handleLogoClick}
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <Bot className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-bold text-lg text-gray-900">
              {activeTeam.name}
            </span>
            <span className="truncate text-xs text-gray-600 font-medium">{activeTeam.plan}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
