import {
  BusFrontIcon,
  BusIcon,
  type LucideIcon,
  TrainFrontIcon,
  TrainFrontTunnelIcon,
  TramFrontIcon,
} from "lucide-react";
import type { TransitKind } from "@/lib/report-sections";

/** Icon per transit stop kind: header shortcuts, chips, pins, thumbnails. */
export const TRANSIT_ICONS: Record<TransitKind, LucideIcon> = {
  subway: TrainFrontTunnelIcon,
  train: TrainFrontIcon,
  light_rail: TramFrontIcon,
  go_bus: BusFrontIcon,
  bus: BusIcon,
};

/** Always shown in the header; the others only when the area has them. */
export const CORE_TRANSIT_KINDS: readonly TransitKind[] = [
  "train",
  "go_bus",
  "bus",
];
