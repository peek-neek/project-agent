import { HeaderTitle } from "@/components/globals/dashboard/header-nav";

// Its own match, so a soft navigation from a report doesn't keep the
// report's Report | Chat switch in the header.
export default function CalculatorsNav() {
  return <HeaderTitle />;
}
