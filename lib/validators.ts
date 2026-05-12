import { z } from "zod";

const MAX_AUDIO_DURATION_SECONDS = Number(
  process.env.MAX_AUDIO_DURATION_SECONDS ?? 900,
);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_AUDIO_BUCKET =
  process.env.SUPABASE_AUDIO_BUCKET ?? "session-audios";

export const analyzeAudioSchema = z.object({
  sessionId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "sessionId contains invalid characters"),
  audio_url: z.string().url(),
  duration: z
    .number()
    .int()
    .positive()
    .max(MAX_AUDIO_DURATION_SECONDS),
});

export type AnalyzeAudioInput = z.infer<typeof analyzeAudioSchema>;

export function validateSupabaseAudioUrl(audioUrl: string): URL {
  const url = new URL(audioUrl);

  if (url.protocol !== "https:") {
    throw new Error("Audio URL must use HTTPS");
  }

  if (SUPABASE_URL && url.hostname !== SUPABASE_URL) {
    throw new Error("Audio URL host is not allowed");
  }

  if (!url.pathname.includes("/storage/v1/object/")) {
    throw new Error("Audio URL is not a Supabase Storage object URL");
  }

  if (!url.pathname.includes(`/${SUPABASE_AUDIO_BUCKET}/`)) {
    throw new Error("Audio URL bucket is not allowed");
  }

  return url;
}
