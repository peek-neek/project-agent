import { auth } from "@clerk/nextjs/server";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/branding";
import {
  getAgentBranding,
  isProAgent,
  putLogo,
  readLogo,
} from "@/server/branding";
import { blobConfigured } from "@/server/video-store";

/** The signed-in agent's logo (private in Blob, so served through here). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const row = await getAgentBranding(userId);
  const logo = row?.logoPath ? await readLogo(row.logoPath) : null;
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.contentType,
      // A new upload changes the URL's ?v=, so this can be cached.
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/**
 * Uploads a new logo or headshot: the file is the raw request body, its
 * type the Content-Type header. PNG or JPEG, up to 2 MB. Pro only.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!(await isProAgent(userId))) {
    return new Response("Your own branding is part of the Pro plan.", {
      status: 403,
    });
  }
  if (!blobConfigured()) {
    return new Response("Uploads need file storage, which isn't set up yet.", {
      status: 503,
    });
  }

  const type = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (!type || !(LOGO_TYPES as readonly string[]).includes(type)) {
    return new Response("Use a PNG or JPEG image.", { status: 415 });
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > LOGO_MAX_BYTES) {
    return new Response("Use an image under 2 MB.", { status: 413 });
  }
  const file = Buffer.from(await request.arrayBuffer());
  if (file.length === 0) return new Response("No file", { status: 400 });
  if (file.length > LOGO_MAX_BYTES) {
    return new Response("Use an image under 2 MB.", { status: 413 });
  }
  if (!matchesType(file, type)) {
    return new Response("That file isn't a PNG or JPEG image.", { status: 415 });
  }

  await putLogo(userId, file, type);
  return Response.json({ ok: true });
}

/** Checks the file's signature, not just the header the browser sent. */
function matchesType(file: Buffer, type: string) {
  if (type === "image/png") {
    return file.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
}
