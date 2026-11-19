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
