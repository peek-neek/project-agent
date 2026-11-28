"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeftRightIcon,
  BadgeDollarSignIcon,
  BuildingIcon,
  CalculatorIcon,
  CheckIcon,
  HandCoinsIcon,
  HouseIcon,
  LandmarkIcon,
  type LucideIcon,
  ReceiptTextIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  ScaleIcon,
  TrendingDownIcon,
  WalletCardsIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { roundTo } from "@/lib/finance/defaults";
import { minDownPayment } from "@/lib/finance/mortgage";
import { RULES_CHECKED } from "@/lib/finance/ontario-rules";
import {
  type CalculatorInputs,
  defaultInputs,
  mergeInputs,
  type PurchaseState,
  type SavedCalculators,
} from "@/lib/finance/scenario";
import { useTRPC } from "@/trpc/client";
import { AffordabilityCalculator } from "./affordability-calculator";
import { BridgeCalculator } from "./bridge-calculator";
import { ClosingCostsCalculator } from "./closing-costs-calculator";
import { CommissionCalculator } from "./commission-calculator";
import { LandTransferCalculator } from "./land-transfer-calculator";
import { MortgageCalculator } from "./mortgage-calculator";
import { OwnershipCalculator } from "./ownership-calculator";
import { PrepaymentCalculator } from "./prepayment-calculator";
import { PropertyTaxCalculator } from "./property-tax-calculator";
import { RefinanceCalculator } from "./refinance-calculator";
import { RentVsBuyCalculator } from "./rent-vs-buy-calculator";
import { RentalCalculator } from "./rental-calculator";
import { SellerNetCalculator } from "./seller-net-calculator";

// The input types live with the shared scenario module (tab, saved
// inputs, PDF and chat all use one shape); re-exported for the screens.
export type {
  AffordState,
  BridgeState,
  ClosingState,
  CommissionState,
  OwnershipState,
  PrepayState,
  PurchaseState,
  RefiState,
  RentalState,
  RentVsBuyState,
  SellerState,
  TaxState,
} from "@/lib/finance/scenario";

/** Inputs autosave this long after the last change. */
const SAVE_DELAY_MS = 800;

type Calc = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

/** Grouped like the questions clients ask: buying, owning, selling… */
const GROUPS = [
  {
    label: "Buying",
    items: [
      {
        id: "payment",
        label: "Payment",
        description: "Mortgage payments, insurance and interest over time",
        icon: CalculatorIcon,
      },
      {
        id: "affordability",
        label: "Affordability",
        description: "The most a buyer qualifies for under the stress test",
        icon: HandCoinsIcon,
      },
      {
        id: "closing",
        label: "Closing costs",
        description: "Cash needed on closing day",
        icon: ReceiptTextIcon,
      },
      {
        id: "landTransfer",
        label: "Land transfer tax",
        description: "Every province's transfer tax, with first-time buyer relief",
        icon: LandmarkIcon,
      },
    ],
  },
  {
    label: "Owning",
    items: [
      {
        id: "ownership",
        label: "Monthly cost",
        description: "Everything it costs to own each month",
        icon: WalletCardsIcon,
      },
      {
        id: "propertyTax",
        label: "Property tax",
        description: "Ontario municipal rates; a typical rate elsewhere",
        icon: BuildingIcon,
      },
      {
        id: "prepayment",
        label: "Prepayment",
        description: "Interest and years saved by paying extra",
        icon: TrendingDownIcon,
      },
      {
        id: "refinance",
        label: "Renewal",
        description: "Renewal or refinance: savings, penalty and break-even",
        icon: RefreshCcwIcon,
      },
    ],
  },
  {
    label: "Selling",
    items: [
      {
        id: "sellerNet",
        label: "Net sheet",
        description: "What the seller walks away with",
        icon: HouseIcon,
      },
      {
        id: "bridge",
        label: "Bridge",
        description: "The cost of buying before selling",
        icon: ArrowLeftRightIcon,
      },
    ],
  },
  {
    label: "Investing",
    items: [
      {
        id: "rental",
        label: "Rental",
        description: "Cash flow, cap rate and returns on a rental",
        icon: BuildingIcon,
      },
      {
        id: "rentVsBuy",
        label: "Rent vs buy",
        description: "Net worth from buying versus renting over time",
        icon: ScaleIcon,
      },
    ],
  },
  {
    label: "Agent",
    items: [
      {
        id: "commission",
        label: "Commission",
        description: "Your take-home after splits and fees",
        icon: BadgeDollarSignIcon,
      },
    ],
  },
] as const satisfies readonly { label: string; items: readonly Calc[] }[];
type CalculatorId = (typeof GROUPS)[number]["items"][number]["id"];
const ALL: readonly Calc[] = GROUPS.flatMap((g): readonly Calc[] => g.items);

/**
 * Property calculators, prefilled from the report: the list price, the
 * city (Toronto's municipal tax, the 2025 property tax rate) and the
 * property type (condo costs, single-family tax bands). Inputs persist
 * while switching calculators.
 */
export function CalculatorsTab({
  reportId,
  storageKey,
  listPrice,
  city,
  province,
  propertyType,
  saved,
}: {
  /** The report to autosave to; omitted on the standalone page. */
  reportId?: string;
  /** Standalone page: autosave to this localStorage key instead. */
  storageKey?: string;
  listPrice: number | null;
  city: string | null;
  province: string | null;
  propertyType: string | null;
  /** Inputs saved on this report earlier (merged over the defaults). */
  saved: SavedCalculators | null;
}) {
  const context = { listPrice, city, province, propertyType };
  const [active, setActive] = useState<CalculatorId>("payment");
  // Start from the defaults with any saved changes laid over them.
  const [start] = useState(() => mergeInputs(defaultInputs(context), saved));
  const [purchase, setPurchaseState] = useState(start.purchase);
  const [afford, setAffordState] = useState(start.afford);
  const [refi, setRefiState] = useState(start.refi);
  const [closing, setClosingState] = useState(start.closing);
  const [seller, setSellerState] = useState(start.seller);
  const [comm, setCommState] = useState(start.comm);
  const [own, setOwnState] = useState(start.own);
  const [rental, setRentalState] = useState(start.rental);
  const [rvb, setRvbState] = useState(start.rvb);
  const [prepay, setPrepayState] = useState(start.prepay);
  const [bridge, setBridgeState] = useState(start.bridge);
  const [tax, setTaxState] = useState(start.tax);

  // Autosave: the agent's figures persist on the report and feed the PDF
  // and the chat. Only edits mark the inputs dirty (not the first render).
  const trpc = useTRPC();
  const { mutate: saveInputs, isPending: saving } = useMutation(
    trpc.report.saveCalculators.mutationOptions(),
  );
  const dirty = useRef(false);
  const [savedAt, setSavedAt] = useState<string | null>(saved?.savedAt ?? null);
  useEffect(() => {
    if (!dirty.current || (!reportId && !storageKey)) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      const inputs = {
        purchase,
        afford,
        refi,
        closing,
        seller,
        comm,
        own,
        rental,
        rvb,
        prepay,
        bridge,
        tax,
      };
      if (reportId) {
        saveInputs(
          { id: reportId, inputs },
          { onSuccess: (r) => setSavedAt(r.savedAt) },
        );
      } else if (storageKey) {
        const at = new Date().toISOString();
        try {
          localStorage.setItem(storageKey, JSON.stringify({ ...inputs, savedAt: at }));
          setSavedAt(at);
        } catch {
          // Storage blocked or full: the figures still work, just unsaved.
        }
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    reportId,
    storageKey,
    saveInputs,
    purchase,
    afford,
    refi,
    closing,
    seller,
    comm,
    own,
    rental,
    rvb,
    prepay,
    bridge,
    tax,
  ]);

  const setAll = (inputs: CalculatorInputs) => {
    setPurchaseState(inputs.purchase);
    setAffordState(inputs.afford);
    setRefiState(inputs.refi);
    setClosingState(inputs.closing);
    setSellerState(inputs.seller);
    setCommState(inputs.comm);
    setOwnState(inputs.own);
    setRentalState(inputs.rental);
    setRvbState(inputs.rvb);
    setPrepayState(inputs.prepay);
    setBridgeState(inputs.bridge);
    setTaxState(inputs.tax);
  };
  /** Back to the defaults for this report, and clear what's saved. */
  const resetAll = () => {
    dirty.current = false;
    setAll(defaultInputs(context));
    if (!reportId) {
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
      }
      setSavedAt(null);
      return;
    }
    saveInputs(
      { id: reportId, inputs: {} },
      { onSuccess: () => setSavedAt(null) },
    );
  };

  // Follow the list price: when it's added or changed in the home details,
  // every price moves with it (the down payment keeps its share, or the
  // minimum; balances keep their share of the value). Without one, the
  // example stays.
  const withPrice = (p: number) => (s: PurchaseState) => {
    const atMinimum = Math.abs(s.downPayment - minDownPayment(s.price)) < 1;
    const share = s.price > 0 ? s.downPayment / s.price : 0.2;
    return {
      ...s,
      price: p,
      downPayment: atMinimum
        ? Math.ceil(minDownPayment(p))
        : roundTo(p * share, 100),
    };
  };
  const scale = (value: number, from: number, to: number, fallback: number) =>
    roundTo(to * (from > 0 ? value / from : fallback), 1_000);
  const applyListPrice = () => {
    if (listPrice == null) return;
    const p = listPrice;
    setPurchaseState(withPrice(p));
    setRefiState((s) => ({
      ...s,
      homeValue: p,
      balance: scale(s.balance, s.homeValue, p, 0.6),
    }));
    setSellerState((s) => ({
      ...s,
      salePrice: p,
      mortgageBalance: scale(s.mortgageBalance, s.salePrice, p, 0.4),
    }));
    setCommState((s) => ({ ...s, salePrice: p }));
    setRentalState((s) => ({
      ...s,
      price: p,
      downPayment: scale(s.downPayment, s.price, p, 0.2),
    }));
  };
  // Adjusting state during render (not in an effect): React's pattern for
  // reacting to a changed prop without a flash of the old numbers.
  const [syncedListPrice, setSyncedListPrice] = useState(listPrice);
  if (listPrice !== syncedListPrice) {
    setSyncedListPrice(listPrice);
    applyListPrice();
  }

  const patch =
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (p: Partial<T>) => {
      dirty.current = true;
      setter((s) => ({ ...s, ...p }));
    };
  const priceProps = {
    listPrice,
    // A click: the agent's choice, so it's saved too.
    onUseListPrice: () => {
      dirty.current = true;
      applyListPrice();
    },
  };
  const current = ALL.find((c) => c.id === active)!;

  return (
    <div className="space-y-4">
      {/* Same control as the header's Report | Chat and travel modes:
          one segmented switch per group, the active one filled. */}
      <nav aria-label="Calculators" className="flex flex-wrap gap-x-5 gap-y-3">
        {GROUPS.map((g) => {
          const ids: readonly string[] = g.items.map((i) => i.id);
          return (
            <div key={g.label} className="space-y-1.5">
              <p className="text-[11px] font-semibold tracking-wide text-foreground/45 uppercase">
                {g.label}
              </p>
              <ToggleGroup
                aria-label={`${g.label} calculators`}
                value={ids.includes(active) ? [active] : []}
                onValueChange={(value) => {
                  const next = value[0] as CalculatorId | undefined;
                  if (next) setActive(next);
                }}
                variant="outline"
                size="sm"
                spacing={0}
              >
                {g.items.map((c) => (
                  <ToggleGroupItem
                    key={c.id}
                    value={c.id}
                    aria-label={c.label}
                    className="gap-1.5 bg-card px-2.5 data-pressed:bg-foreground data-pressed:text-background"
                  >
                    <c.icon aria-hidden />
                    {c.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* <p className="text-sm text-foreground/60">
          <span className="font-semibold text-foreground">
            {current.label}:
          </span>{" "}
          {current.description}.
          {!reportId
            ? " These start from an example; your changes stay in this browser."
            : listPrice == null
              ? " No list price yet, so these start from an example; add it in the home details above and every calculator updates."
              : ""}
        </p> */}
        {/* Fixed-height status, so saving never shifts the layout. */}
        <div className="flex h-8 items-center gap-2 text-xs text-foreground/55">
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Spinner className="size-3.5" />
              Saving…
            </span>
          ) : savedAt ? (
            <span className="flex items-center gap-1.5">
              <CheckIcon aria-hidden className="size-3.5 text-emerald-600" />
              {reportId
                ? "Saved to this report, used in the PDF and chat"
                : "Saved in this browser"}
            </span>
          ) : null}
          {/* Standalone: nothing is saved, so reset is always on offer. */}
          {savedAt || !reportId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAll}
              disabled={saving}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reset to defaults
            </Button>
          ) : null}
        </div>
      </div>

      <div>
        {active === "payment" && (
          <MortgageCalculator
            state={purchase}
            set={patch(setPurchaseState)}
            {...priceProps}
          />
        )}
        {active === "affordability" && (
          <AffordabilityCalculator
            purchase={purchase}
            setPurchase={patch(setPurchaseState)}
            state={afford}
            set={patch(setAffordState)}
            listPrice={listPrice}
          />
        )}
        {active === "closing" && (
          <ClosingCostsCalculator
            purchase={purchase}
            setPurchase={patch(setPurchaseState)}
            state={closing}
            set={patch(setClosingState)}
            {...priceProps}
          />
        )}
        {active === "landTransfer" && (
          <LandTransferCalculator
            state={purchase}
            set={patch(setPurchaseState)}
            city={city}
            {...priceProps}
          />
        )}
        {active === "ownership" && (
          <OwnershipCalculator
            purchase={purchase}
            setPurchase={patch(setPurchaseState)}
            afford={afford}
            setAfford={patch(setAffordState)}
            state={own}
            set={patch(setOwnState)}
            {...priceProps}
          />
        )}
        {active === "propertyTax" && (
          <PropertyTaxCalculator
            state={tax}
            set={patch(setTaxState)}
            price={purchase.price}
            province={purchase.province}
          />
        )}
        {active === "prepayment" && (
          <PrepaymentCalculator state={prepay} set={patch(setPrepayState)} />
        )}
        {active === "refinance" && (
          <RefinanceCalculator
            state={refi}
            set={patch(setRefiState)}
            {...priceProps}
          />
        )}
        {active === "sellerNet" && (
          <SellerNetCalculator
            state={seller}
            set={patch(setSellerState)}
            province={purchase.province}
            {...priceProps}
          />
        )}
        {active === "bridge" && (
          <BridgeCalculator
            state={bridge}
            set={patch(setBridgeState)}
            province={purchase.province}
          />
        )}
        {active === "rental" && (
          <RentalCalculator
            state={rental}
            set={patch(setRentalState)}
            province={purchase.province}
            {...priceProps}
          />
        )}
        {active === "rentVsBuy" && (
          <RentVsBuyCalculator
            purchase={purchase}
            setPurchase={patch(setPurchaseState)}
            state={rvb}
            set={patch(setRvbState)}
            taxRate={afford.taxRate}
            {...priceProps}
          />
        )}
        {active === "commission" && (
          <CommissionCalculator
            province={purchase.province}
            state={comm}
            set={patch(setCommState)}
            {...priceProps}
          />
        )}
      </div>

      <p className="text-xs text-foreground/50">
        Estimates for discussion, not financial or legal advice. Provincial
        and federal rules last checked {RULES_CHECKED}; Ontario property tax
        rates from the BMA 2025 Municipal Study (elsewhere a typical
        provincial rate); typical costs are starting points to adjust.
        Lenders, insurers and lawyers confirm the final figures.
      </p>
    </div>
  );
}
