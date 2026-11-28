"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ImageUpIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef, useState } from "react";
import { SeePlansButton } from "@/components/globals/dashboard/see-plans-prompt";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  type AgentBrandingInput,
  AREAVIEW,
  agentBrandingInputSchema,
  contactLines,
  EMPTY_AGENT_BRANDING,
  hasAgentIdentity,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
} from "@/lib/branding";
import { useTRPC } from "@/trpc/client";

/**
 * The "Agent / broker" tab's state, owned by the download dialog: the draft
 * starts from what's saved each time the dialog opens, and `saveIfChanged`
 * runs when the agent downloads (so the PDF or video carries the edits).
 */
export function useBrandingDraft() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = useQuery({ ...trpc.branding.get.queryOptions(), staleTime: 0 });
  const save = useMutation(trpc.branding.save.mutationOptions());
  const [draft, setDraft] = useState<AgentBrandingInput | null>(null);

  const saved = query.data?.input ?? EMPTY_AGENT_BRANDING;
  const value = draft ?? saved;
  const changed = draft != null && JSON.stringify(draft) !== JSON.stringify(saved);
  const parsed = agentBrandingInputSchema.safeParse(value);

  return {
    query,
    value,
    setValue: (patch: Partial<AgentBrandingInput>) =>
      setDraft({ ...value, ...patch }),
    /** Back to what's saved (call when the dialog opens). */
    reset: () => setDraft(null),
    /** Problems that block saving (only checked for Pro agents). */
    error: query.data?.pro && !parsed.success ? "Check the email address." : null,
    saving: save.isPending,
    saveError: save.error?.message ?? null,
    async saveIfChanged() {
      if (!query.data?.pro || !changed || !parsed.success) return;
      await save.mutateAsync(parsed.data);
      setDraft(null);
      await queryClient.invalidateQueries(trpc.branding.get.queryFilter());
    },
  };
}

export type BrandingDraft = ReturnType<typeof useBrandingDraft>;

/**
 * Who the PDF or video is from. Pro: the agent's details and logo, as they
 * appear at the bottom left of every PDF page and on the video's last
 * card. Otherwise Areaview's, with the way to upgrade.
 */
export function AgentBrandingTab({ draft }: { draft: BrandingDraft }) {
  const { query, value, setValue } = draft;
  const { data: billing } = useQuery(useTRPC().billing.status.queryOptions());

  if (query.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load your branding</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  const { pro, logoUrl } = query.data;

  if (!pro) {
    const starter = billing?.subscribed && billing.plan === "starter";
    return (
      <div className="space-y-4">
        <BrandPreview branding={null} logoUrl={null} />
        <Alert>
          <SparklesIcon />
          <AlertTitle>Your own branding is part of Pro</AlertTitle>
          <AlertDescription>
            On Pro, your name, brokerage, contact details and logo replace
            Areaview&apos;s at the bottom of every PDF page and at the end of
            every video.
          </AlertDescription>
          <AlertAction>
            {starter ? (
              // Plain <a>: the route creates a Stripe session, so no prefetch.
              <Button
                size="sm"
                nativeButton={false}
                render={<a href="/billing/portal" />}
              >
                Upgrade to Pro
              </Button>
            ) : (
              <SeePlansButton label="See plans" variant="default" />
            )}
          </AlertAction>
        </Alert>
      </div>
    );
  }

  const field = (
    key: keyof AgentBrandingInput,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <Field>
      <FieldLabel htmlFor={`brand-${key}`}>{label}</FieldLabel>
      <Input
        id={`brand-${key}`}
        value={value[key]}
        onChange={(e) => setValue({ [key]: e.target.value })}
        {...props}
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      <BrandPreview branding={value} logoUrl={logoUrl} />
      {!hasAgentIdentity(value) && (
        <p className="text-xs text-foreground/60">
          Add your brokerage to use your branding; until then
          Areaview&apos;s is used.
        </p>
      )}
      <LogoPicker logoUrl={logoUrl} />
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        {field("brokerage", "Brokerage", {
          autoComplete: "organization",
          placeholder: "Maple Realty Inc., Brokerage",
        })}
        {field("phone", "Phone", { type: "tel", autoComplete: "tel" })}
        {field("email", "Email", {
          type: "email",
          autoComplete: "email",
          "aria-invalid": draft.error ? true : undefined,
        })}
        {field("website", "Website", { placeholder: "jordanlee.ca" })}
      </FieldGroup>
      {draft.error && <p className="text-xs text-destructive">{draft.error}</p>}
      {draft.saveError && (
        <p className="text-xs text-destructive">{draft.saveError}</p>
      )}
    </div>
  );
}

/** Upload, replace or remove the logo or headshot. */
function LogoPicker({ logoUrl }: { logoUrl: string | null }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries(trpc.branding.get.queryFilter());

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
        throw new Error("Use a PNG or JPEG image.");
      }
      if (file.size > LOGO_MAX_BYTES) throw new Error("Use an image under 2 MB.");
      const res = await fetch("/api/branding/logo", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error((await res.text()) || "Upload failed.");
    },
    onMutate: () => setError(null),
    onError: (e) => setError(e.message),
    onSuccess: refresh,
  });
  const remove = useMutation(
    trpc.branding.removeLogo.mutationOptions({ onSuccess: refresh }),
  );
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        ref={input}
        type="file"
        accept={LOGO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {upload.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <ImageUpIcon data-icon="inline-start" />
        )}
        {logoUrl ? "Replace logo" : "Upload logo or headshot"}
      </Button>
      {logoUrl && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => remove.mutate()}
          className="text-foreground/65"
        >
          <Trash2Icon data-icon="inline-start" />
          Remove
        </Button>
      )}
      <span className="text-xs text-foreground/55">PNG or JPEG, up to 2 MB</span>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** "Maple Realty" → "MR": stands in for the logo until one is uploaded. */
const initials = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * The brand as the PDF footer shows it, at a readable size: a small logo
 * (or initials), the brokerage, and one line of contacts. The video's last
 * card shows the same details, larger.
 */
function BrandPreview({
  branding,
  logoUrl,
}: {
  branding: AgentBrandingInput | null;
  logoUrl: string | null;
}) {
  const agent = branding && hasAgentIdentity(branding) ? branding : null;
  const contacts = agent ? contactLines(agent) : [];
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-foreground/55">
        Preview: bottom left of every PDF page and the video&apos;s last card
      </p>
      <Item variant="outline" className="flex-nowrap gap-3 rounded-none bg-card px-3 py-2.5">
        <ItemMedia className="size-9 shrink-0 overflow-hidden border bg-white">
          {agent ? (
            logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated route
              <img src={logoUrl} alt="" className="size-full object-contain p-0.5" />
            ) : (
              <span className="text-xs font-semibold text-zinc-500">
                {initials(agent.brokerage)}
              </span>
            )
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden className="size-5 text-primary">
              <path fill="currentColor" d={AREAVIEW.markPath} />
            </svg>
          )}
        </ItemMedia>
        <ItemContent className="min-w-0 gap-0">
          <ItemTitle className="w-full truncate font-semibold">
            {agent ? agent.brokerage : AREAVIEW.name}
          </ItemTitle>
          <p
            className="truncate text-xs text-muted-foreground"
            title={contacts.join(" · ") || undefined}
          >
            {agent ? contacts.join(" · ") || "Add a phone, email or website" : AREAVIEW.tagline}
          </p>
        </ItemContent>
      </Item>
    </div>
  );
}
