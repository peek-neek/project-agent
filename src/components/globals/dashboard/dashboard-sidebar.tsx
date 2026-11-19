"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  FileTextIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  type Transition,
  type Variants,
} from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useRef, useState } from "react";
import { Logo } from "@/components/globals/homepage/logo";
import { startNavigationProgress } from "@/components/globals/top-progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import {
  DeleteReportDialog,
  type ReportToDelete,
} from "./delete-report-dialog";
import {
  RenameReportDialog,
  type ReportToRename,
} from "./rename-report-dialog";
import { SidebarUser } from "./sidebar-user";

// Motion versions of the shadcn pieces (React 19 passes `ref` through props).
const MotionSidebarGroup = motion.create(SidebarGroup);
const MotionSidebarMenuItem = motion.create(SidebarMenuItem);

/** No overshoot: this is a work tool. */
const layoutTransition: Transition = {
  type: "spring",
  bounce: 0,
  visualDuration: 0.3,
};

/**
 * Rows fade and rise in (staggered on first load), slide out when deleted or
 * filtered away, and the rest glide into the gap.
 */
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: "easeOut",
      delay: Math.min(index, 10) * 0.03,
    },
  }),
  exit: { opacity: 0, x: -16, transition: { duration: 0.18, ease: "easeIn" } },
};

// Fixed widths: random ones break prerendering (cacheComponents).
const SKELETON_WIDTHS = ["78%", "62%", "85%", "70%", "56%", "74%"];

type HistoryItem = {
  id: string;
  name: string | null;
  inputAddress: string;
  createdAt: Date | string;
  property: { formattedAddress: string | null; city: string | null } | null;
};

/**
 * Title and subtitle for a history row. Without a custom name:
 * "12 Main St" / "Toronto". With one: "Smith listing" / "12 Main St · Toronto".
 */
function describe(item: HistoryItem) {
  const full = item.property?.formattedAddress ?? item.inputAddress;
  const [street, ...rest] = full.split(",").map((s) => s.trim());
  const place =
    item.property?.city ??
    rest
      .filter((s) => s !== "Canada")
      .slice(0, 1)
      .join(", ");
  return item.name
    ? {
        full,
        title: item.name,
        subtitle: [street, place].filter(Boolean).join(" · "),
      }
    : { full, title: street, subtitle: place };
}

const DAY = 86_400_000;

/** Today / Previous 7 days / Previous 30 days / Older. */
function groupByAge(items: HistoryItem[]) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const groups = [
    { label: "Today", from: startOfToday, items: [] as HistoryItem[] },
    {
      label: "Previous 7 days",
      from: startOfToday - 7 * DAY,
      items: [] as HistoryItem[],
    },
    {
      label: "Previous 30 days",
      from: startOfToday - 30 * DAY,
      items: [] as HistoryItem[],
    },
    { label: "Older", from: -Infinity, items: [] as HistoryItem[] },
  ];
  for (const item of items) {
    const time = new Date(item.createdAt).getTime();
    groups.find((g) => time >= g.from)!.items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

/** Search text and mobile-close handler, shared with the history slot. */
const HistoryContext = createContext<{
  search: string;
  onNavigate: () => void;
}>({ search: "", onNavigate: () => {} });

export function HistorySkeleton() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Reports</SidebarGroupLabel>
      <SidebarMenu>
        {SKELETON_WIDTHS.map((width) => (
          <SidebarMenuItem
            key={width}
            className="flex items-center gap-2 px-2 py-2.5"
          >
            <Skeleton className="size-4" />
            <span className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5" style={{ width }} />
              <Skeleton className="h-2.5 w-1/3" />
            </span>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/**
 * The agent's reports. Reads the list prefetched by the dashboard layout
 * (suspends until it streams in); loading and errors are handled by the
 * surrounding QueryBoundary.
 */
export function ReportHistory() {
  const trpc = useTRPC();
  const pathname = usePathname();
  const { search, onNavigate } = use(HistoryContext);
  const { data } = useSuspenseQuery(trpc.report.list.queryOptions());
  const [toDelete, setToDelete] = useState<ReportToDelete | null>(null);
  const [toRename, setToRename] = useState<ReportToRename | null>(null);

  const term = search.trim().toLowerCase();
  const reports = data.filter(
    (r) =>
      !term ||
      `${r.name ?? ""} ${describe(r).full}`.toLowerCase().includes(term),
  );
  if (reports.length === 0) {
    return (
      <p className="px-5 py-3 text-sm text-foreground/60">
        {term
          ? "No reports match your search."
          : "No reports yet. Enter an address to create your first one."}
      </p>
    );
  }

  let rowIndex = 0;
  return (
    <>
      <AnimatePresence initial={false}>
        {groupByAge(reports).map((group) => (
          <MotionSidebarGroup
            key={group.label}
            layout="position"
            transition={layoutTransition}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="py-1"
          >
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu className="relative">
              <AnimatePresence mode="popLayout">
                {group.items.map((report) => {
                  const href = `/reports/${report.id}`;
                  const { full, title, subtitle } = describe(report);
                  return (
                    <MotionSidebarMenuItem
                      key={report.id}
                      layout
                      custom={rowIndex++}
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={{ layout: layoutTransition }}
                    >
                      <SidebarMenuButton
                        size="lg"
                        isActive={pathname === href}
                        render={
                          <Link
                            href={href}
                            title={full}
                            onClick={onNavigate}
                            onNavigate={startNavigationProgress}
                          />
                        }
                        className="h-auto py-2"
                      >
                        <FileTextIcon
                          aria-hidden
                          className="text-foreground/50"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {title}
                          </span>
                          {subtitle && (
                            <span className="block truncate text-xs text-foreground/55">
                              {subtitle}
                            </span>
                          )}
                        </span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            // Not `showOnHover`: it also shows on focus-within, so
                            // the dots stuck around after a mouse dismiss (focus
                            // returns to the trigger). :focus-visible only
                            // matches keyboard focus.
                            <SidebarMenuAction
                              aria-label={`More actions for ${title}`}
                              className="-translate-y-1/2 peer-data-[size=lg]/menu-button:top-1/2 group-hover/menu-item:opacity-100 focus-visible:opacity-100 data-popup-open:bg-sidebar-accent data-popup-open:opacity-100 md:opacity-0"
                            />
                          }
                        >
                          <MoreVerticalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="right"
                          align="start"
                          className="w-40"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              setToRename({
                                id: report.id,
                                name: report.name,
                                address: full,
                              })
                            }
                          >
                            <PencilIcon />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setToDelete({ id: report.id, label: title })
                            }
                          >
                            <Trash2Icon />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </MotionSidebarMenuItem>
                  );
                })}
              </AnimatePresence>
            </SidebarMenu>
          </MotionSidebarGroup>
        ))}
      </AnimatePresence>
      <RenameReportDialog report={toRename} onClose={() => setToRename(null)} />
      <DeleteReportDialog report={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}

/**
 * `history` is a slot rendered by the (server) dashboard layout, so the
 * report list can be prefetched on the server and streamed in.
 */
export function DashboardSidebar({ history }: { history: React.ReactNode }) {
  const { isMobile, setOpenMobile, setOpen } = useSidebar();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    // Collapses to an icon rail; the state persists in the `sidebar_state`
    // cookie (see PersistedSidebarProvider).
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:p-2">
        <Logo
          href="/dashboard"
          className="px-1 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[&>span]:hidden"
        />
        <SidebarMenu className="gap-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New report"
              render={
                <Link
                  href="/dashboard"
                  onClick={closeOnMobile}
                  onNavigate={startNavigationProgress}
                />
              }
              className="h-10 flex items-center justify-center bg-primary px-4 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              <PlusIcon />
              <span>New report</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Collapsed only: expand and jump straight into search. */}
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
            <SidebarMenuButton
              tooltip="Search reports"
              onClick={() => {
                setOpen(true);
                // After the expand transition starts, so the input exists.
                setTimeout(() => searchRef.current?.focus(), 220);
              }}
            >
              <SearchIcon />
              <span>Search reports</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <InputGroup className="h-9 bg-background group-data-[collapsible=icon]:hidden">
          <InputGroupInput
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports"
            aria-label="Search reports"
            className="pl-4"
          />
          <InputGroupAddon align="inline-end" className="pr-3">
            <SearchIcon aria-hidden />
          </InputGroupAddon>
        </InputGroup>
      </SidebarHeader>

      <SidebarContent className="pb-4 group-data-[collapsible=icon]:hidden">
        <HistoryContext value={{ search, onNavigate: closeOnMobile }}>
          {history}
        </HistoryContext>
      </SidebarContent>

      {/* The signed-in agent: name, email, account and sign out. mt-auto
          keeps it at the bottom when collapsed (the history list is hidden
          then, so nothing else fills the space). */}
      <SidebarFooter className="mt-auto border-t p-2">
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
