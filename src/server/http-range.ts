// HTTP Range support for small in-memory files (voiceover clips). Safari
// won't play <audio> unless the server answers byte-range requests with
// 206 Partial Content; Chrome and Firefox also use ranges to seek.

/**
 * The whole file (200), the requested bytes (206), or 416 when the range
 * can't be met. `headers` are added to every response (type, caching).
 */
export function rangeResponse(
  request: Request,
  data: Uint8Array,
  headers: Record<string, string>,
) {
  const size = data.length;
  const base = { ...headers, "Accept-Ranges": "bytes" };
  const range = request.headers.get("range");
  if (!range) {
    return new Response(new Uint8Array(data), {
      headers: { ...base, "Content-Length": String(size) },
    });
  }

  const bytes = parseRange(range, size);
  if (!bytes) {
    return new Response(null, {
      status: 416,
      headers: { ...base, "Content-Range": `bytes */${size}` },
    });
  }
  const [start, end] = bytes;
  return new Response(data.slice(start, end + 1), {
    status: 206,
    headers: {
      ...base,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}

/**
 * "bytes=0-99", "bytes=100-" or "bytes=-500" (the last 500) → inclusive
 * [start, end]; null when malformed or outside the file. Only the first
 * range of a multi-range request is served.
 */
export function parseRange(header: string, size: number): [number, number] | null {
  const match = /^bytes=(\d*)-(\d*)/.exec(header.trim());
  if (!match || size === 0) return null;
  const [, from, to] = match;
  if (from === "" && to === "") return null;
  if (from === "") {
    const suffix = Number(to);
    if (suffix === 0) return null;
    return [Math.max(0, size - suffix), size - 1];
  }
  const start = Number(from);
  const end = to === "" ? size - 1 : Math.min(Number(to), size - 1);
  if (start >= size || end < start) return null;
  return [start, end];
}
