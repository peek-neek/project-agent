"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { ChevronsUpDownIcon, LogOutIcon, UserCogIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/**
 * The signed-in agent in the sidebar footer: avatar, name and email, with a
 * menu for account settings and sign out. Collapsed sidebar: avatar only.
 *
 * Clerk loads in the browser (the sidebar is in the prerendered shell), so
 * until it's ready a skeleton of exactly the same size holds the row.
 */
export function SidebarUser() {
  const { isLoaded, user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const { isMobile } = useSidebar();

  if (!isLoaded || !user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            disabled
            aria-label="Loading your account"
            className="disabled:opacity-100"
          >
            <Skeleton className="size-8 shrink-0" />
            <span className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-36" />
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const name =
    user.fullName ??
    user.username ??
    user.primaryEmailAddress?.emailAddress ??
    "Your account";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const avatar = (
    <Avatar className="size-8 shrink-0 rounded-none">
      <AvatarImage src={user.imageUrl} alt="" className="rounded-none" />
      <AvatarFallback className="rounded-none text-xs">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={name}
                className="data-popup-open:bg-sidebar-accent"
              />
            }
          >
            {avatar}
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs text-foreground/55">
                {email}
              </span>
            </span>
            <ChevronsUpDownIcon aria-hidden className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
            className="min-w-56"
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              {avatar}
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium">{name}</span>
                <span className="truncate text-xs text-foreground/55">
                  {email}
                </span>
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openUserProfile()}>
              <UserCogIcon />
              Manage account
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOut({ redirectUrl: "/" })}
            >
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
