import type { VercelRequest, VercelResponse } from "@vercel/node";
import { groq } from "../lib/groq";
import {
  analyzeAudioSchema,
  type AnalyzeAudioInput,
  validateSupabaseAudioUrl,
} from "../lib/validators";

type ApiSuccess<T> = {
  message: string;
  data: T;
};

type ApiError = {
  message: string;
  code: string;
  details?: unknown;
};

type TranscriptAnalysis = {
  transcript: string;
  filler_words: string[];
  filler_count: number;
  repeated_words: string[];
  total_words: number;
  overall_score: number;
  summary: string;
};

const AUDIO_FETCH_TIMEOUT_MS = 30_000;
const AI_TIMEOUT_MS = 60_000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const SINGLE_WORD_FILLERS = new Set([
  "e",
  "ee",
  "eee",
  "eeee",
  "eh",
  "em",
  "emm",
  "emmm",
  "hm",
  "hmm",
  "hmmm",
  "mmm",
  "um",
  "umm",
  "uh",
  "anu",
  "anuu",
  "nah",
  "jadi",
  "terus",
  "kayak",
  "gitu",
  "tuh",
  "ya",
  "kan",
]);
const PHRASE_FILLERS = [
  ["apa", "ya"],
  ["apa", "namanya"],
  ["apa", "tuh"],
  ["apa", "itu"],
  ["gimana", "ya"],
  ["ini", "tuh"],
  ["itu", "tuh"],
  ["yang", "kayak"],
  ["kayak", "gitu"],
].sort((a, b) => b.length - a.length);
const REDUNDANT_PHRASES = [
  ["sangat", "sekali"],
  ["amat", "sangat"],
  ["paling", "terbaik"],
  ["agar", "supaya"],
  ["demi", "untuk"],
  ["adalah", "merupakan"],
  ["naik", "ke", "atas"],
  ["turun", "ke", "bawah"],
  ["masuk", "ke", "dalam"],
  ["keluar", "ke", "luar"],
  ["maju", "ke", "depan"],
  ["mundur", "ke", "belakang"],
  ["kembali", "lagi"],
  ["ulang", "kembali"],
  ["mengulang", "kembali"],
  ["sejak", "dari"],
  ["para", "hadirin", "sekalian"],
  ["para", "teman", "teman", "sekalian"],
  ["hadirin", "sekalian"],
].sort((a, b) => b.length - a.length);

function sendSuccess<T>(
  res: VercelResponse,
  statusCode: number,
  payload: ApiSuccess<T>,
): void {
  res.status(statusCode).json(payload);
}

function sendError(
  res: VercelResponse,
  statusCode: number,
  payload: ApiError,
): void {
  res.status(statusCode).json(payload);
}

function validateAudioResponse(response: Response): void {
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: HTTP ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");

  if (contentLength && Number(contentLength) > MAX_AUDIO_BYTES) {
    throw new Error("Audio file exceeds 25 MB limit");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const allowedTypes = [
    "audio/m4a",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/webm",
    "application/octet-stream",
  ];

  if (!allowedTypes.some((type) => contentType.includes(type))) {
    throw new Error(`Unsupported audio content type: ${contentType}`);
  }
}

async function validateRemoteAudio(input: AnalyzeAudioInput): Promise<void> {
  validateSupabaseAudioUrl(input.audio_url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(input.audio_url, {
      method: "HEAD",
      signal: controller.signal,
    });

    validateAudioResponse(response);
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeAudio(input: AnalyzeAudioInput): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const transcription = await groq.audio.transcriptions.create(
      {
        url: input.audio_url,
        model: "whisper-large-v3-turbo",
        language: "id",
        response_format: "json",
        temperature: 0,
      },
      {
        signal: controller.signal,
      },
    );

    return transcription.text ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

function tokenizeTranscript(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function detectFillerWords(words: string[]): string[] {
  const fillerWords: string[] = [];
  const phraseIndexes = new Set<number>();

  for (let index = 0; index < words.length; index += 1) {
    const phrase = PHRASE_FILLERS.find((candidate) =>
      candidate.every((word, offset) => words[index + offset] === word),
    );

    if (!phrase) continue;

    fillerWords.push(phrase.join(" "));
    phrase.forEach((_, offset) => phraseIndexes.add(index + offset));
    index += phrase.length - 1;
  }

  words.forEach((word, index) => {
    const isAcousticFiller =
      /^e+h?$/.test(word) ||
      /^e+m+$/.test(word) ||
      /^e+u+m+$/.test(word) ||
      /^u+h+$/.test(word) ||
      /^u+m+$/.test(word) ||
      /^h+m+$/.test(word) ||
      /^m{2,}$/.test(word);

    if (
      !phraseIndexes.has(index) &&
      (SINGLE_WORD_FILLERS.has(word) || isAcousticFiller)
    ) {
      fillerWords.push(word);
    }
  });

  return fillerWords;
}

function detectPhraseMatches(
  words: string[],
  phrasePatterns: string[][],
): string[] {
  const matches: string[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const phrase = phrasePatterns.find((candidate) =>
      candidate.every((word, offset) => words[index + offset] === word),
    );

    if (!phrase) continue;

    matches.push(phrase.join(" "));
    index += phrase.length - 1;
  }

  return matches;
}

function detectWordWaste(words: string[]): string[] {
  const wastePhrases: string[] = [];

  for (let index = 1; index < words.length; index += 1) {
    if (words[index] === words[index - 1]) {
      wastePhrases.push(`${words[index - 1]} ${words[index]}`);
    }
  }

  return [...wastePhrases, ...detectPhraseMatches(words, REDUNDANT_PHRASES)];
}

function analyzeTranscriptText(transcript: string): TranscriptAnalysis {
  const words = tokenizeTranscript(transcript);
  const filler_words = detectFillerWords(words);
  const repeated_words = detectWordWaste(words);

  const filler_count = filler_words.length;
  const total_words = words.length;
  const penalty = Math.min(60, filler_count * 3 + repeated_words.length * 2);
  const overall_score = Math.max(40, 100 - penalty);

  return {
    transcript,
    filler_words,
    filler_count,
    repeated_words,
    total_words,
    overall_score,
    summary:
      filler_count > 0
        ? "Kurangi filler words dan pertahankan struktur kalimat agar penyampaian lebih jelas."
        : "Penyampaian cukup bersih dari filler words. Pertahankan tempo dan artikulasi.",
  };
}

async function saveTranscriptToDatabase(
  input: AnalyzeAudioInput,
  analysis: TranscriptAnalysis,
): Promise<void> {
  // Production implementation:
  // 1. Validate user owns sessionId using auth token.
  // 2. Upsert transcript and analysis into session feedback table.
  // 3. Store audio_url in recordings table.
  //
  // Example with Supabase service role:
  //
  // const supabase = createClient(
  //   process.env.SUPABASE_URL!,
  //   process.env.SUPABASE_SERVICE_ROLE_KEY!,
  // );
  //
  // const { error } = await supabase.from("game_recordings").upsert({
  //   session_id: input.sessionId,
  //   audio_url: input.audio_url,
  //   transcript: analysis.transcript,
  //   duration_seconds: input.duration,
  // });
  //
  // if (error) throw error;

  console.info("[analyze-audio] transcript ready", {
    sessionId: input.sessionId,
    duration: input.duration,
    totalWords: analysis.total_words,
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendError(res, 405, {
      message: "Method not allowed",
      code: "METHOD_NOT_ALLOWED",
    });
    return;
  }

  try {
    const parsed = analyzeAudioSchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, 400, {
        message: "Invalid request body",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
      return;
    }

    const input = parsed.data;

    console.info("[analyze-audio] request accepted", {
      sessionId: input.sessionId,
      duration: input.duration,
    });

    await validateRemoteAudio(input);
    const transcript = await transcribeAudio(input);
    const analysis = analyzeTranscriptText(transcript);

    await saveTranscriptToDatabase(input, analysis);

    sendSuccess<TranscriptAnalysis>(res, 200, {
      message: "Audio analyzed successfully",
      data: analysis,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    console.error("[analyze-audio] failed", {
      message,
    });

    if (message.includes("Audio URL")) {
      sendError(res, 400, {
        message,
        code: "INVALID_AUDIO_URL",
      });
      return;
    }

    if (message.includes("25 MB") || message.includes("Unsupported audio")) {
      sendError(res, 413, {
        message,
        code: "AUDIO_TOO_LARGE_OR_UNSUPPORTED",
      });
      return;
    }

    if (message.includes("Failed to fetch audio")) {
      sendError(res, 422, {
        message,
        code: "AUDIO_FETCH_FAILED",
      });
      return;
    }

    sendError(res, 500, {
      message: "Failed to analyze audio",
      code: "AUDIO_ANALYSIS_FAILED",
    });
  }
}
