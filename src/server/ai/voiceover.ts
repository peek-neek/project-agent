// Text-to-speech for the map video, with provider fallback: OpenAI → Gemini.
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateSpeech, type SpeechModel } from "ai";

const STYLE =
  "A warm, confident local real estate presenter. Natural, unhurried pace; friendly, never salesy. Canadian English.";

type Voice = {
  label: string;
  apiKeyEnv: string;
  create: () => SpeechModel;
  voice: string;
  /** Raw 24 kHz 16-bit mono PCM is the easiest to time exactly. */
  outputFormat?: string;
};

/** Tried in this order. Model and voice can be overridden by env vars. */
const VOICES: Voice[] = [
  {
    label: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    create: () => openai.speech(process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts"),
    voice: process.env.OPENAI_TTS_VOICE || "coral",
    outputFormat: "pcm",
  },
  {
    label: "Gemini",
    apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    create: () => google.speech(process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts"),
    voice: process.env.GEMINI_TTS_VOICE || "Kore",
  },
];

const PCM = { sampleRate: 24_000, channels: 1, bitsPerSample: 16 };

/** Wraps raw PCM in a WAV header so browsers and Remotion can play it. */
function pcmToWav(pcm: Uint8Array, format = PCM) {
  const blockAlign = (format.channels * format.bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(format.channels, 22);
  header.writeUInt32LE(format.sampleRate, 24);
  header.writeUInt32LE(format.sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(format.bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, Buffer.from(pcm)]);
}

/**
 * A WAV file and its exact length. Accepts WAV (re-timed from its own
 * header: streamed WAVs often carry a placeholder size) or raw PCM.
 */
export function toTimedWav(bytes: Uint8Array, mediaType: string) {
  const buf = Buffer.from(bytes);
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") {
    let offset = 12;
    let format = PCM;
    while (offset + 8 <= buf.length) {
      const id = buf.toString("ascii", offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      if (id === "fmt ") {
        format = {
          channels: buf.readUInt16LE(offset + 10),
          sampleRate: buf.readUInt32LE(offset + 12),
          bitsPerSample: buf.readUInt16LE(offset + 22),
        };
      }
      if (id === "data") {
        const pcm = buf.subarray(offset + 8);
        return timed(pcmToWav(pcm, format), pcm.length, format);
      }
      offset += 8 + size + (size % 2);
    }
    throw new Error("Voiceover WAV has no audio data.");
  }
  // audio/L16;rate=24000 (Gemini) or raw PCM (OpenAI "pcm").
  const rate = Number(/rate=(\d+)/.exec(mediaType)?.[1]) || PCM.sampleRate;
  const format = { ...PCM, sampleRate: rate };
  return timed(pcmToWav(buf, format), buf.length, format);
}

function timed(wav: Buffer, dataBytes: number, format: typeof PCM) {
  const bytesPerSecond = (format.sampleRate * format.channels * format.bitsPerSample) / 8;
  return { wav, durationSec: dataBytes / bytesPerSecond };
}

export class VoiceoverUnavailableError extends Error {}

/** One spoken line as a WAV file, from the first provider that works. */
export async function speak(text: string) {
  const attempts: string[] = [];
  for (const v of VOICES) {
    if (!process.env[v.apiKeyEnv]) {
      attempts.push(`${v.label}: not configured`);
      continue;
    }
    try {
      const { audio } = await generateSpeech({
        model: v.create(),
        text,
        voice: v.voice,
        instructions: STYLE,
        outputFormat: v.outputFormat,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(60_000),
      });
      return { ...toTimedWav(audio.uint8Array, audio.mediaType), provider: v.label };
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0]! : String(error);
      attempts.push(`${v.label}: ${message.slice(0, 160)}`);
      console.warn(`[voiceover] ${v.label} failed: ${message}`);
    }
  }
  throw new VoiceoverUnavailableError(
    `No text-to-speech provider worked. ${attempts.join(" · ")}`.slice(0, 400),
  );
}
