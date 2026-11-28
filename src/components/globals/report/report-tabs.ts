import {
  CalculatorIcon,
  ClapperboardIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MegaphoneIcon,
  PresentationIcon,
  RouteIcon,
  ShieldCheckIcon,
  StoreIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { JOB_KINDS, type JobKind } from "@/lib/report-sections";

/** Report dashboard tabs, in the order buyers care about them. */
export const REPORT_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboardIcon, kinds: [] },
  {
    id: "amenities",
    label: "Amenities",
    icon: StoreIcon,
    kinds: [JOB_KINDS.amenities],
  },
  {
    id: "commute",
    label: "Commute",
    icon: RouteIcon,
    kinds: [JOB_KINDS.commute],
  },
  {
    id: "schools",
    label: "Schools",
    icon: GraduationCapIcon,
    kinds: [JOB_KINDS.schools],
  },
  {
    id: "safety",
    label: "Safety",
    icon: ShieldCheckIcon,
    kinds: [JOB_KINDS.safety],
  },
  {
    id: "neighbourhood",
    label: "Neighbourhood",
    icon: UsersIcon,
    kinds: [JOB_KINDS.demographics],
  },
  {
    id: "upside",
    label: "Upside",
    icon: TrendingUpIcon,
    kinds: [JOB_KINDS.upside],
  },
  // Works from the list price alone: no background step to wait for.
  { id: "calculators", label: "Calculators", icon: CalculatorIcon, kinds: [] },
  { id: "video", label: "Video", icon: ClapperboardIcon, kinds: [] },
  {
    id: "marketing",
    label: "Marketing",
    icon: MegaphoneIcon,
    kinds: [JOB_KINDS.ai],
  },
  // Made on demand: its progress lives in the "video" section, not a job.
  {
    id: "playbook",
    label: "Playbook",
    icon: PresentationIcon,
    kinds: [JOB_KINDS.ai],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  icon: LucideIcon;
  kinds: readonly JobKind[];
}[];

export type TabId = (typeof REPORT_TABS)[number]["id"];

export const parseTab = (value: string | null): TabId =>
  REPORT_TABS.some((t) => t.id === value) ? (value as TabId) : "overview";
