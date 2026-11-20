"use client";

import { LandmarkIcon } from "lucide-react";
import { landTransferTax } from "@/lib/finance/land-transfer-tax";
import {
  ONTARIO_FTB_REFUND,
  TORONTO_FTB_REBATE,
} from "@/lib/finance/ontario-rules";
import {
  BigResult,
  Breakdown,
  CalcLayout,
  ListPriceHint,
  MoneyField,
  Notice,
  Panel,
  pct,
  StatGrid,
  SwitchField,
  money,
} from "./calc-ui";
import type { PurchaseState } from "./calculators-tab";

export function LandTransferCalculator({
  state,
  set,
  city,
  listPrice,
  onUseListPrice,
}: {
  state: PurchaseState;
  set: (patch: Partial<PurchaseState>) => void;
  city: string | null;
  listPrice: number | null;
  onUseListPrice: () => void;
}) {
  const t = landTransferTax({
    price: state.price,
    toronto: state.toronto,
    firstTimeBuyer: state.firstTimeBuyer,
    singleFamily: state.singleFamily,
    nonResident: state.nonResident,
  });
  const saved = t.provincialRebate + t.municipalRebate;

  return (
    <CalcLayout
      inputs={
        <>
          <MoneyField
            label="Purchase price"
            value={state.price}
            onChange={(v) => set({ price: v })}
            hint={
              <ListPriceHint
                value={state.price}
                listPrice={listPrice}
                onUse={onUseListPrice}
              />
            }
          />
          <SwitchField
            label="In the City of Toronto"
            description={
              city
                ? `Set from this report (${city}). Toronto adds its own municipal tax.`
                : "Toronto adds its own municipal tax."
            }
            checked={state.toronto}
            onChange={(v) => set({ toronto: v })}
          />
          <SwitchField
            label="First-time buyer"
            description={`Refund up to ${money(ONTARIO_FTB_REFUND)} provincially${
              state.toronto
                ? ` and ${money(TORONTO_FTB_REBATE)} in Toronto`
                : ""
            }.`}
            checked={state.firstTimeBuyer}
            onChange={(v) => set({ firstTimeBuyer: v })}
          />
          <SwitchField
            label="One or two single-family homes"
            description="Houses and semis. Higher rates above $2M apply only to these."
            checked={state.singleFamily}
            onChange={(v) => set({ singleFamily: v })}
          />
          <SwitchField
            label="Buyer isn't a citizen or permanent resident"
            description="Adds the 25% Non-Resident Speculation Tax (and 10% in Toronto)."
            checked={state.nonResident}
            onChange={(v) => set({ nonResident: v })}
          />
        </>
      }
      results={
        <>
          <BigResult
            label="Land transfer tax"
            value={money(t.total)}
            caption={
              <>
                Paid on closing.{" "}
                {state.price > 0 ? pct(t.total / state.price) : "0%"} of the
                price
                {saved > 0
                  ? `, after ${money(saved)} in first-time buyer rebates`
                  : ""}
                .
              </>
            }
          />
          <StatGrid
            items={[
              {
                label: "Ontario tax",
                value: money(t.provincial - t.provincialRebate),
              },
              {
                label: "Toronto tax",
                value: state.toronto
                  ? money(t.municipal - t.municipalRebate)
                  : "—",
                hint: state.toronto ? undefined : "Outside Toronto",
              },
              {
                label: "Rebates",
                value: money(saved),
                hint: state.firstTimeBuyer ? "First-time buyer" : "Not claimed",
              },
            ]}
          />
          <Panel title="Breakdown" icon={LandmarkIcon}>
            <Breakdown
              rows={[
                {
                  label: "Ontario land transfer tax",
                  value: money(t.provincial),
                },
                ...(t.provincialRebate
                  ? [
                      {
                        label: "First-time buyer refund (Ontario)",
                        value: `−${money(t.provincialRebate)}`,
                        muted: true,
                      },
                    ]
                  : []),
                ...(state.toronto
                  ? [
                      {
                        label: "Toronto municipal land transfer tax",
                        value: money(t.municipal),
                      },
                    ]
                  : []),
                ...(t.municipalRebate
                  ? [
                      {
                        label: "First-time buyer rebate (Toronto)",
                        value: `−${money(t.municipalRebate)}`,
                        muted: true,
                      },
                    ]
                  : []),
                ...(t.nonResident
                  ? [
                      {
                        label: "Non-resident speculation tax",
                        value: money(t.nonResident),
                      },
                    ]
                  : []),
              ]}
              total={{ label: "Total due on closing", value: money(t.total) }}
            />
          </Panel>
          {state.firstTimeBuyer ? (
            <Notice>
              First-time buyers must never have owned a home anywhere, must move
              in within nine months, and (in Toronto) be a Canadian citizen or
              permanent resident. A spouse who owned a home while married to the
              buyer can affect eligibility.
            </Notice>
          ) : null}
        </>
      }
    />
  );
}
