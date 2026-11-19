import { CarIcon, ClockIcon, TrainFrontIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type CommuteData, TRANSIT_KINDS } from "@/lib/report-sections";
import { MapImage } from "./map-image";
import { PlaceList } from "./place-list";
import { formatMinutes } from "./report-format";
import { ReportSubsection } from "./report-layout";

export function CommuteSection({
  reportId,
  commute,
}: {
  reportId: string;
  commute: CommuteData;
}) {
  const dash = <span className="text-foreground/40">—</span>;
  return (
    <>
      <ReportSubsection title="Commute times" icon={ClockIcon}>
        <div className="overflow-hidden ring-1 ring-border print:border print:border-border print:ring-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4">Destination</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1.5">
                    <CarIcon aria-hidden className="size-4" /> Drive
                  </span>
                </TableHead>
                <TableHead className="pr-4">
                  <span className="flex items-center gap-1.5">
                    <TrainFrontIcon aria-hidden className="size-4" /> Transit
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commute.destinations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="pl-4 font-medium whitespace-normal">
                    {d.label}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {d.driveMinutes != null ? (
                      <>
                        {formatMinutes(d.driveMinutes)}
                        {d.driveKm != null && (
                          <span className="ml-1 text-xs text-foreground/55">
                            ({d.driveKm} km)
                          </span>
                        )}
                      </>
                    ) : (
                      dash
                    )}
                  </TableCell>
                  <TableCell className="pr-4 tabular-nums">
                    {d.transitMinutes != null
                      ? formatMinutes(d.transitMinutes)
                      : dash}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-foreground/55">
          {commute.routesAvailable
            ? `${commute.departureLabel}, with typical traffic.`
            : "Drive and transit times need the Google Routes API to be enabled."}
        </p>
      </ReportSubsection>

      {commute.stations.length > 0 && (
        <ReportSubsection title="Nearest transit" icon={TrainFrontIcon}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] print:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <MapImage
              src={`/api/reports/${reportId}/maps/transit?v=${encodeURIComponent(commute.fetchedAt)}`}
              alt="Map of nearby transit stations and stops"
            />
            <PlaceList
              places={commute.stations}
              color={(i) => TRANSIT_KINDS[commute.stations[i].kind].color}
              badge={(i) => (
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 text-[10px] text-foreground/70"
                >
                  {TRANSIT_KINDS[commute.stations[i].kind].label}
                </Badge>
              )}
            />
          </div>
        </ReportSubsection>
      )}
    </>
  );
}
