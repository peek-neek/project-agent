// The agent's branding and its logo in private Blob storage. Shared by
// Next.js and Trigger.dev tasks (the video render), so no "server-only".
import { del, get, put } from "@vercel/blob";
import {
  type AgentBrandingInput,
  type Branding,
  brandingKey,
  EMPTY_AGENT_BRANDING,
  hasAgentIdentity,
} from "../lib/branding";
import { db } from "./db";
import { hasActiveSubscription } from "./entitlements";

/** Own branding is a Pro feature (an active Pro subscription). */
export async function isProAgent(userId: string) {
  const account = await db.billingAccount.findUnique({ where: { userId } });
  return hasActiveSubscription(account) && account.plan === "pro";
}

export function getAgentBranding(userId: string) {
  return db.agentBranding.findUnique({ where: { userId } });
}

/** The saved details as form values (empty strings for missing ones). */
export function toInput(
  row: Awaited<ReturnType<typeof getAgentBranding>>,
): AgentBrandingInput {
  if (!row) return EMPTY_AGENT_BRANDING;
  return {
    brokerage: row.brokerage ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
  };
}

export function saveAgentBranding(userId: string, input: AgentBrandingInput) {
  // Empty fields are stored as null, so "not set" has one representation.
  const data = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, v.trim() || null]),
  );
  return db.agentBranding.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/** Stores a new logo (replacing the old one); returns the saved row. */
export async function putLogo(userId: string, file: Buffer, contentType: string) {
  const previous = await getAgentBranding(userId);
  const ext = contentType === "image/png" ? "png" : "jpg";
  const blob = await put(`branding/${userId}/logo.${ext}`, file, {
    access: "private",
    contentType,
    addRandomSuffix: true,
  });
  const row = await db.agentBranding.upsert({
    where: { userId },
    create: { userId, logoPath: blob.pathname },
    update: { logoPath: blob.pathname },
  });
  if (previous?.logoPath) await deleteQuietly(previous.logoPath);
  return row;
}

export async function removeLogo(userId: string) {
  const previous = await getAgentBranding(userId);
  if (!previous?.logoPath) return previous;
  const row = await db.agentBranding.update({
    where: { userId },
    data: { logoPath: null },
  });
  await deleteQuietly(previous.logoPath);
  return row;
}

async function deleteQuietly(pathname: string) {
  await del(pathname).catch((error: unknown) =>
    console.warn("[branding] couldn't delete the old logo", error),
  );
}

/** The logo's bytes and type, or null when it can't be read. */
export async function readLogo(pathname: string) {
  const file = await get(pathname, { access: "private" }).catch(() => null);
  if (!file || file.statusCode !== 200) return null;
  const data = Buffer.from(await new Response(file.stream).arrayBuffer());
  return { data, contentType: file.blob.contentType ?? "image/png" };
}

/**
 * Whose branding this agent's PDFs and videos carry: their own on Pro (once
 * they've given their brokerage), else Areaview's. `logoSrc`
 * turns the stored logo into a URL the caller can load.
 */
export async function brandingFor(
  userId: string,
  logoSrc: (pathname: string, updatedAt: Date) => string | Promise<string>,
): Promise<Branding> {
  let pro: boolean;
  let row: Awaited<ReturnType<typeof getAgentBranding>>;
  try {
    [pro, row] = await Promise.all([isProAgent(userId), getAgentBranding(userId)]);
  } catch (error) {
    // A lookup failure (e.g. the table isn't migrated yet) must never block
    // a PDF or video: fall back to Areaview's branding.
    console.warn("[branding] lookup failed; using Areaview's", error);
    return { kind: "areaview" };
  }
  const input = toInput(row);
  if (!pro || !hasAgentIdentity(input)) return { kind: "areaview" };
  return {
    kind: "agent",
    ...input,
    logoSrc: row?.logoPath ? await logoSrc(row.logoPath, row.updatedAt) : null,
  };
}

/**
 * Identifies the branding a video would close with right now (the logo by
 * its pathname, which changes with every upload).
 */
export async function brandingVersion(userId: string) {
  return brandingKey(await brandingFor(userId, (pathname) => pathname));
}

/** Where the app serves the signed-in agent's logo (see /api/branding/logo). */
export const appLogoUrl = (_pathname: string, updatedAt: Date) =>
  `/api/branding/logo?v=${updatedAt.getTime()}`;
