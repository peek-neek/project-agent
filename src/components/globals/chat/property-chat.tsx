"use client";

import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  type UseTriggerChatTransportOptions,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react";
import type { UIMessage } from "ai";
import {
  AlertCircleIcon,
  ArrowUpIcon,
  FileTextIcon,
  GlobeIcon,
  LoaderCircleIcon,
  MapPinIcon,
  PenLineIcon,
  RotateCcwIcon,
  RouteIcon,
  SearchIcon,
  SquareIcon,
  SquarePenIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { BillingStatus } from "@/components/globals/dashboard/plans-dialog";
import { SeePlansButton } from "@/components/globals/dashboard/see-plans-prompt";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { useTravelMode } from "@/components/globals/travel-mode";
import { isChatRefusal } from "@/lib/billing";
import type { comparisonChat } from "@/trigger/comparison-chat";
import type { propertyChat } from "@/trigger/property-chat";
import { useTRPC } from "@/trpc/client";
import {
  mintPropertyChatToken,
  newPropertyChat,
  startPropertyChat,
} from "./actions";
import { CopyButton } from "../report/copy-button";
import { StickyNote } from "../report/sticky-note";
import { Markdown } from "./markdown";

type Part = UIMessage["parts"][number];

/** A tool part, loosely typed (tools are defined on the server). */
type ToolPart = {
  type: string;
  state: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
};

const isToolPart = (part: Part): part is Part & ToolPart =>
  part.type.startsWith("tool-");

/** One line per tool call: what it's doing, then what it found. */
function ToolTrace({ part }: { part: ToolPart }) {
  const name = part.type.slice("tool-".length);
  const running =
    part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error" || Boolean(part.output?.error);
  const input = part.input ?? {};
  const output = part.output ?? {};

  let icon = <SearchIcon />;
  let title = "Working…";
  if (name === "find_places") {
    icon = <MapPinIcon />;
    const q = String(input.query ?? "");
    const n = Array.isArray(output.results) ? output.results.length : 0;
    title = running
      ? `Searching Google Maps for “${q}”`
      : `Searched Google Maps for “${q}” · ${n} place${n === 1 ? "" : "s"}`;
  } else if (name === "travel_time") {
    icon = <RouteIcon />;
    const to = String(input.destination ?? "");
    const mode = String(input.mode ?? "");
    title = running
      ? `Routing to ${to} by ${mode}`
      : output.minutes != null
        ? `${output.minutes} min by ${mode} to ${to} (${output.km} km)`
        : `Couldn't route to ${to}`;
  } else if (name === "web_search") {
    icon = <GlobeIcon />;
    const action = output.action as { query?: string } | undefined;
    title = running
      ? "Searching the web"
      : action?.query
        ? `Searched the web for “${action.query}”`
        : "Searched the web";
  }

  return (
    <TraceLine status={running ? "running" : failed ? "error" : undefined}>
      <TraceIcon>
        {running ? <LoaderCircleIcon className="animate-spin" /> : icon}
      </TraceIcon>
      <TraceTitle>{title}</TraceTitle>
    </TraceLine>
  );
}

/** Web sources cited in an answer, as small links. */
function Sources({ parts }: { parts: Part[] }) {
  const seen = new Set<string>();
  const sources = parts.flatMap((p) => {
    if (p.type !== "source-url" || seen.has(p.url)) return [];
    seen.add(p.url);
    let host = p.url;
    try {
      host = new URL(p.url).hostname.replace(/^www\./, "");
    } catch {}
    return [{ url: p.url, label: p.title || host, host }];
  });
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-xs text-foreground/50">Sources</span>
      {sources.slice(0, 8).map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          title={s.label}
          className="inline-flex max-w-56 items-center gap-1 border bg-card px-1.5 py-0.5 text-xs text-foreground/70 hover:text-primary"
        >
          <GlobeIcon aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{s.host}</span>
        </a>
      ))}
    </div>
  );
}

const textOf = (m: UIMessage) =>
  m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n\n");

/** Three bouncing dots while the answer hasn't started yet. */
function TypingDots() {
  return (
    <div role="status" className="flex h-6 items-center gap-1">
      <span className="sr-only">Thinking…</span>
      {["[animation-delay:-0.3s]", "[animation-delay:-0.15s]", ""].map((d) => (
        <span
          key={d}
          aria-hidden
          className={`size-2 animate-bounce rounded-full bg-foreground/50 motion-reduce:animate-none ${d}`}
        />
      ))}
    </div>
  );
}

function ChatMessage({
  message,
  streaming,
}: {
  message: UIMessage;
  streaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          {/* Light bubble in both themes: dark text in dark mode to stay readable. */}
          <Bubble
            align="end"
            variant="muted"
            className="*:data-[slot=bubble-content]:bg-zinc-200 dark:*:data-[slot=bubble-content]:bg-zinc-300 dark:*:data-[slot=bubble-content]:text-zinc-900"
          >
            <BubbleContent className="rounded-none whitespace-pre-wrap">
              {textOf(message)}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }
  const tools = message.parts.filter(isToolPart);
  const text = textOf(message);
  return (
    <Message>
      <MessageContent className="gap-3">
        {/* Stream open but nothing written yet: keep the dots up. */}
        {streaming && tools.length === 0 && !text && <TypingDots />}
        {tools.length > 0 && (
          <Trace>
            {tools.map((p, i) => (
              <ToolTrace key={i} part={p} />
            ))}
          </Trace>
        )}
        {message.parts.map((p, i) =>
          p.type === "text" && p.text ? (
            <Markdown key={i} text={p.text} />
          ) : null,
        )}
        <Sources parts={message.parts} />
        {!streaming && text && (
          <MessageFooter className="px-0">
            <CopyButton text={text} />
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

export type ChatSuggestion = { icon: typeof FileTextIcon; question: string };

/** One of each kind: from the report, beyond it (tools), and writing. */
const SUGGESTIONS: ChatSuggestion[] = [
  {
    icon: FileTextIcon,
    question: "What are the 3 strongest selling points for this home?",
  },
  {
    icon: GlobeIcon,
    question: "Is there a Costco or big-box store nearby?",
  },
  {
    icon: PenLineIcon,
    question: "Write an Instagram caption for an open house this Saturday.",
  },
];

/** What the empty conversation says: a heading, a line, three questions. */
export type ChatIntro = {
  title: string;
  description: string;
  suggestions: ChatSuggestion[];
};

function EmptyState({
  intro,
  onAsk,
}: {
  intro: ChatIntro;
  onAsk: (q: string) => void;
}) {
  return (
    // m-auto: centred both ways in the (full-height, flex) conversation area.
    <div className="m-auto flex w-full max-w-3xl flex-col items-center px-4 py-10 text-center">
      <h2 className="text-xl font-semibold tracking-tight text-balance">
        {intro.title}
      </h2>
      <p className="mt-1.5 max-w-lg text-sm text-foreground/60">
        {intro.description}
      </p>
      <div className="mt-8 grid w-full gap-2 text-left md:grid-cols-3">
        {intro.suggestions.map(({ icon: Icon, question }) => (
          <Button
            key={question}
            variant="outline"
            onClick={() => onAsk(question)}
            className="h-auto items-start justify-start gap-2.5 bg-card px-3 py-2.5 text-left text-sm leading-snug font-normal whitespace-normal"
          >
            <Icon aria-hidden className="mt-0.5 text-foreground/50" />
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** The chat about one property: history, answers with sources, composer. */
export function PropertyChat({ reportId }: { reportId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: report } = useSuspenseQuery(
    trpc.report.byId.queryOptions({ id: reportId }),
  );
  const { data: thread } = useSuspenseQuery(
    trpc.report.chatThread.queryOptions({ id: reportId }),
  );
  const [starting, setStarting] = useState(false);

  // "New chat": a fresh thread (new chat id, new durable session).
  const startNewChat = async () => {
    setStarting(true);
    try {
      const chatId = await newPropertyChat(reportId);
      queryClient.setQueryData(
        trpc.report.chatThread.queryKey({ id: reportId }),
        { chatId, messages: [], session: null },
      );
    } finally {
      setStarting(false);
    }
  };

  if (!report) {
    return (
      <p className="p-8 text-center text-sm text-foreground/60">
        This report doesn&apos;t exist or isn&apos;t yours.
      </p>
    );
  }
  const full = report.property?.formattedAddress ?? report.inputAddress;
  const street = full.split(",")[0]!.trim();
  return (
    <ChatSession
      key={thread.chatId}
      chatId={thread.chatId}
      // Saved by the agent as UI messages; tRPC's JSON typing loses that.
      initialMessages={thread.messages as unknown as UIMessage[]}
      session={thread.session}
      agent={{
        task: "property-chat",
        accessToken: ({ chatId }) => mintPropertyChatToken(chatId),
        startSession: ({ chatId, clientData }) =>
          startPropertyChat({ chatId, clientData }),
        // First message of a new chat: step 1 runs in our warm server while
        // the agent boots (Head Start). Later messages go to the agent direct.
        headStart: `/api/reports/${reportId}/chat`,
      }}
      context={
        <>
          <MapPinIcon aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 truncate text-sm font-medium" title={full}>
            {full}
          </span>
          <StickyNote report={report} street={street} size="sm" />
        </>
      }
      intro={{
        title: `Ask anything about ${street}`,
        description:
          "Answers draw on this whole report, Google Maps and the web, with the sources named. Times follow your walk / car setting.",
        suggestions: SUGGESTIONS,
      }}
      placeholder={`Ask anything about ${street}…`}
      hint="Uses the report, Google Maps and the web · check before sharing"
      onNewChat={startNewChat}
      startingNewChat={starting}
    />
  );
}

/** Either chat agent; they take the same client data (travel mode). */
type ChatTask = typeof propertyChat | typeof comparisonChat;

/** Which agent a session talks to, and the server actions that admit it. */
export type ChatAgentConfig = Pick<
  UseTriggerChatTransportOptions<ChatTask>,
  "task" | "accessToken" | "startSession" | "headStart"
>;

/**
 * One conversation, backed by a durable Trigger.dev chat agent: answers keep
 * running if the tab closes, and a reload reconnects to the live stream.
 * Shared by the property chat and the comparison chat: `agent` picks the
 * backend, `context` fills the bar on top, `intro` the empty conversation.
 */
export function ChatSession({
  chatId,
  initialMessages,
  session,
  agent,
  context,
  intro,
  placeholder,
  hint,
  onNewChat,
  startingNewChat,
}: {
  chatId: string;
  initialMessages: UIMessage[];
  session: { publicAccessToken: string; lastEventId?: string } | null;
  agent: ChatAgentConfig;
  context: ReactNode;
  intro: ChatIntro;
  placeholder: string;
  hint: string;
  onNewChat: () => void;
  startingNewChat: boolean;
}) {
  const travel = useTravelMode();
  const transport = useTriggerChatTransport<ChatTask>({
    ...agent,
    // Sent with every message; the hook keeps it current.
    clientData: { travelMode: travel.mode },
    // An existing conversation: resume from where the browser left off.
    sessions: session ? { [chatId]: session } : undefined,
  });
  const {
    messages,
    sendMessage,
    status,
    stop: stopLocal,
    error,
    regenerate,
  } = useChat({
    id: chatId,
    transport,
    messages: initialMessages,
    // Reconnect to an answer still being written (after a reload).
    resume: initialMessages.length > 0,
  });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Monthly AI chat allowance: block the composer up front (the agent and
  // the first-message route refuse too), and refresh usage after each answer.
  const trpcClient = useTRPC();
  const queryClient = useQueryClient();
  const { data: billing } = useQuery({
    ...trpcClient.billing.status.queryOptions(),
    staleTime: 0,
    retry: false,
  });
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      void queryClient.invalidateQueries(trpcClient.billing.status.queryFilter());
    }
    wasBusy.current = busy;
  }, [busy, queryClient, trpcClient]);
  // This month's plan messages, or Basic's free ones (never reset).
  const chatLeft = billing ? Math.max(0, billing.chatLimit - billing.chatUsed) : null;
  const chatBlocked = chatLeft === 0;
  const basic = billing != null && !billing.subscribed;

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy || chatBlocked) return;
    sendMessage({ text: t });
    setInput("");
  };
  // Stop locally and tell the agent (works after a resume too).
  const stop = () => {
    stopLocal();
    transport.stopGeneration(chatId);
  };
  const clear = () => {
    if (busy) stop();
    onNewChat();
  };

  const last = messages.at(-1);

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      {/* What the chat is about, and a fresh start. */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 sm:px-6">
        {context}
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={messages.length === 0 || startingNewChat}
          className="ml-auto shrink-0 text-foreground/65"
        >
          <SquarePenIcon data-icon="inline-start" />
          New chat
        </Button>
      </div>

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
              {messages.length === 0 ? (
                <EmptyState intro={intro} onAsk={send} />
              ) : (
                messages.map((m) => (
                  <MessageScrollerItem
                    key={m.id}
                    messageId={m.id}
                    scrollAnchor={m.role === "user"}
                  >
                    <ChatMessage
                      message={m}
                      streaming={busy && m.id === last?.id}
                    />
                  </MessageScrollerItem>
                ))
              )}
              {/* Waiting for the first words of an answer. */}
              {status === "submitted" && (
                <MessageScrollerItem>
                  <Message>
                    <MessageContent>
                      <TypingDots />
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
              {error && !busy && (
                <MessageScrollerItem>
                  <div className="flex items-center gap-3 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircleIcon aria-hidden className="size-4 shrink-0" />
                    <span className="flex-1">
                      {isChatRefusal(error)
                        ? /\b402\b/.test(error.message)
                          ? "You've used your AI chat messages for now. See your plan for more."
                          : error.message
                        : error.message || "Something went wrong."}
                    </span>
                    {isChatRefusal(error) ? (
                      // Retrying can't help; the dashboard shows the plan.
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href="/dashboard" />}
                      >
                        See plan
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => regenerate()}
                      >
                        <RotateCcwIcon data-icon="inline-start" />
                        Retry
                      </Button>
                    )}
                  </div>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Composer: Enter sends, Shift+Enter for a new line. */}
      <div className="shrink-0 border-t bg-background/85 px-4 py-3 backdrop-blur-md sm:px-6">
        {/* Monthly messages used up (no plan: the "See plans" line below). */}
        {chatBlocked && billing && (
          <ChatAllowanceNotice billing={billing} className="mx-auto mb-3 w-full max-w-3xl" />
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto w-full max-w-3xl"
        >
          {/* Clearly live: firm border and soft lift, darker on hover, brand
              red on focus; readable placeholder. */}
          <InputGroup className="border-foreground/20 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.05),0_8px_24px_-12px_rgb(0_0_0/0.18)] transition-[border-color,box-shadow] hover:border-foreground/35 has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-primary/15">
            <InputGroupTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send(input);
                }
              }}
              ref={inputRef}
              autoFocus={!chatBlocked}
              disabled={chatBlocked}
              placeholder={
                chatBlocked
                  ? basic
                    ? "You've used your free AI chat messages"
                    : "You've used this month's AI chat messages"
                  : placeholder
              }
              aria-label="Message"
              rows={1}
              className="max-h-40 min-h-12 px-3.5 pt-3 text-[15px] text-foreground placeholder:text-foreground/50"
            />
            <InputGroupAddon align="block-end" className="justify-between">
              <span className="text-xs text-foreground/55">
                {billing && chatLeft != null && chatLeft > 0 && chatLeft <= 10
                  ? `${chatLeft} of ${billing.chatLimit} ${basic ? "free chat messages left" : "chat messages left this month"} · check before sharing`
                  : hint}
              </span>
              {busy ? (
                <InputGroupButton
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Stop"
                  onClick={() => stop()}
                >
                  <SquareIcon className="fill-current" />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="icon-sm"
                  aria-label="Send"
                  disabled={chatBlocked}
                  onClick={(e) => {
                    // Nothing typed yet: put the cursor in the box instead.
                    if (!input.trim()) {
                      e.preventDefault();
                      inputRef.current?.focus();
                    }
                  }}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </div>
  );
}

const chatDate = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

/** Why the composer is off: this month's (or Basic's free) messages are used. */
function ChatAllowanceNotice({
  billing,
  className,
}: {
  billing: BillingStatus;
  className?: string;
}) {
  if (!billing.subscribed) {
    return (
      <Alert className={className}>
        <AlertCircleIcon />
        <AlertTitle>
          You&apos;ve used your {billing.chatLimit} free AI chat messages
        </AlertTitle>
        <AlertDescription>
          Plans include{" "}
          {billing.plans.map((p) => p.chat).sort((x, y) => x - y).join(" to ")}{" "}
          AI chat messages a month, plus monthly reports. The report itself
          stays fully available.
        </AlertDescription>
        <AlertAction>
          <SeePlansButton label="Choose a plan" variant="default" />
        </AlertAction>
      </Alert>
    );
  }
  const resets = billing.reportsResetAt ? chatDate.format(new Date(billing.reportsResetAt)) : null;
  const starter = billing.plan === "starter";
  return (
    <Alert className={className}>
      <AlertCircleIcon />
      <AlertTitle>
        You&apos;ve used your {billing.chatLimit} AI chat messages this month
      </AlertTitle>
      <AlertDescription>
        {resets ? `More on ${resets}. ` : ""}
        {starter
          ? "Pro includes 100 a month; you pay only the prorated difference to switch."
          : "The report itself stays fully available."}
      </AlertDescription>
      {starter && (
        <AlertAction>
          {/* Plain <a>: the route creates a Stripe session, so no prefetch. */}
          <Button size="sm" nativeButton={false} render={<a href="/billing/portal" />}>
            Upgrade to Pro
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
