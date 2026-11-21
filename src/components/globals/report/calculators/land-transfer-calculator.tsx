"use client";

import { LandmarkIcon } from "lucide-react";
import {
  ONTARIO_FTB_REFUND,
  TORONTO_FTB_REBATE,
} from "@/lib/finance/ontario-rules";
import {
  PROVINCE_CODES,
  PROVINCE_NAMES,
  type Province,
  transferTax,
} from "@/lib/finance/provinces";
import {
  BigResult,
  Breakdown,
  CalcLayout,
  ListPriceHint,
  MoneyField,
  Notice,
  Panel,
  pct,
  SelectField,
  StatGrid,
  SwitchField,
  money,
} from "./calc-ui";
import type { PurchaseState } from "./calculators-tab";

/** What first-time buyers get, by province (none where the row is missing). */
const FTB_RELIEF: Partial<Record<Province, string>> = {
  ON: `Refund up to ${money(ONTARIO_FTB_REFUND)} provincially, plus ${money(TORONTO_FTB_REBATE)} in Toronto.`,
  BC: "No tax on the first $500K for homes up to $835K, phasing out by $860K.",
  QC: "Quebec credit: the first $5,000 of welcome tax plus 25% of the next $3,500 (up to $5,875).",
  PE: "Eligible first-time buyers are exempt.",
};

/** Foreign-buyer taxes, by province. */
const NON_RESIDENT_TAX: Partial<Record<Province, string>> = {
  ON: "Adds the 25% Non-Resident Speculation Tax (and 10% in Toronto).",
  BC: "Adds BC's 20% additional transfer tax in Metro Vancouver, Fraser Valley, Capital, Central Okanagan and Nanaimo.",
  NS: "Adds Nova Scotia's 10% non-resident deed transfer tax.",
};

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
  const province = state.province;
  const t = transferTax({
    province,
    price: state.price,
    toronto: province === "ON" && state.toronto,
    montreal: province === "QC" && state.montreal,
    firstTimeBuyer: state.firstTimeBuyer,
    singleFamily: state.singleFamily,
    nonResident: state.nonResident,
  });
  const saved = t.provincialRebate + t.municipalRebate;
  const ftb = FTB_RELIEF[province];
  const foreign = NON_RESIDENT_TAX[province];
  const region = PROVINCE_NAMES[province];
  const ontario = province === "ON";
  const municipalOnly = province === "QC" || province === "NS";

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
          <SelectField
            label="Province or territory"
            value={province}
            onChange={(v) => set({ province: v })}
            options={PROVINCE_CODES.map((code) => ({
              value: code,
              label: PROVINCE_NAMES[code],
            }))}
            hint={city ? `Set from this report (${city}).` : undefined}
          />
          {ontario && (
            <SwitchField
              label="In the City of Toronto"
              description="Toronto adds its own municipal tax."
              checked={state.toronto}
              onChange={(v) => set({ toronto: v })}
            />
          )}
          {province === "QC" && (
            <SwitchField
              label="In the City of Montréal"
              description="Montréal charges higher rates above $552,300."
              checked={state.montreal}
              onChange={(v) => set({ montreal: v })}
            />
          )}
          {ftb && (
            <SwitchField
              label="First-time buyer"
              description={ftb}
              checked={state.firstTimeBuyer}
              onChange={(v) => set({ firstTimeBuyer: v })}
            />
          )}
          {ontario && (
            <SwitchField
              label="One or two single-family homes"
              description="Houses and semis. Higher rates above $2M apply only to these."
              checked={state.singleFamily}
              onChange={(v) => set({ singleFamily: v })}
            />
          )}
          {foreign && (
            <SwitchField
              label="Buyer isn't a citizen or permanent resident"
              description={foreign}
              checked={state.nonResident}
              onChange={(v) => set({ nonResident: v })}
            />
          )}
        </>
      }
      results={
        <>
          <BigResult
            label={t.estimate ? `${t.label} (estimate)` : t.label}
            value={money(t.total)}
            caption={
              <>
                Paid on closing.{" "}
                {state.price > 0 ? pct(t.total / state.price) : "0%"} of the
                price
                {saved > 0
                  ? `, after ${money(saved)} in first-time buyer relief`
                  : ""}
                . {t.note}
              </>
            }
          />
          <StatGrid
            items={[
              ontario
                ? {
                    label: "Ontario tax",
                    value: money(t.provincial - t.provincialRebate),
                  }
                : {
                    label: municipalOnly ? "Municipal" : region,
                    value: money(
                      t.provincial - t.provincialRebate + t.municipal - t.municipalRebate,
                    ),
                  },
              ontario
                ? {
                    label: "Toronto tax",
                    value: state.toronto
                      ? money(t.municipal - t.municipalRebate)
                      : "—",
                    hint: state.toronto ? undefined : "Outside Toronto",
                  }
                : {
                    label: "Foreign buyer tax",
                    value: t.nonResident ? money(t.nonResident) : "—",
                    hint: foreign ? undefined : "None in this province",
                  },
              {
                label: "Rebates",
                value: money(saved),
                hint: !ftb
                  ? "None in this province"
                  : state.firstTimeBuyer
                    ? "First-time buyer"
                    : "Not claimed",
              },
            ]}
          />
          <Panel title="Breakdown" icon={LandmarkIcon}>
            <Breakdown
              rows={[
                ...(t.provincial
                  ? [
                      {
                        label: ontario ? "Ontario land transfer tax" : t.label,
                        value: money(t.provincial),
                      },
                    ]
                  : []),
                ...(t.provincialRebate
                  ? [
                      {
                        label: `First-time buyer relief (${region})`,
                        value: `−${money(t.provincialRebate)}`,
                        muted: true,
                      },
                    ]
                  : []),
                ...(t.municipal
                  ? [
                      {
                        label: ontario
                          ? "Toronto municipal land transfer tax"
                          : t.label,
                        value: money(t.municipal),
                      },
                    ]
                  : []),
                ...(t.municipalRebate
                  ? [
                      {
                        label: ontario
                          ? "First-time buyer rebate (Toronto)"
                          : "First-time buyer credit",
                        value: `−${money(t.municipalRebate)}`,
                        muted: true,
                      },
                    ]
                  : []),
                ...(t.nonResident
                  ? [
                      {
                        label: ontario
                          ? "Non-resident speculation tax"
                          : "Foreign / non-resident buyer tax",
                        value: money(t.nonResident),
                      },
                    ]
                  : []),
              ]}
              total={{ label: "Total due on closing", value: money(t.total) }}
            />
          </Panel>
          {ftb && state.firstTimeBuyer ? (
            <Notice>
              First-time buyer relief has conditions: generally never having
              owned a home, living in it as a principal residence, and
              residency or citizenship rules that vary by province. Confirm
              eligibility with the buyer&apos;s lawyer or notary.
            </Notice>
          ) : null}
          {!t.isTax ? (
            <Notice>
              {region} has no land transfer tax; buyers pay registration fees
              instead.
            </Notice>
          ) : null}
        </>
      }
    />
  );
}
