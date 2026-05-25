import { AssemblyAI } from 'assemblyai';
import Groq from 'groq-sdk';
import { supabaseAdmin } from '../config/supabase.js';

const TEMPO_WINDOW_SECONDS = 10;

// Groq ApiKeyRotator
class GroqApiKeyRotator {
  constructor() {
    this.keys = process.env.GROQ_API_KEY?.split(',').map(k => k.trim()) || [];
    this.currentIndex = 0;
  }

  getNextClient() {
    if (this.keys.length === 0) {
      throw new Error('No API keys found in .env (GROQ_API_KEY)');
    }
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return new Groq({ apiKey: key });
  }

  getKeyCount() {
    return this.keys.length;
  }
}

const groqRotator = new GroqApiKeyRotator();

// AssemblyAI ApiKeyRotator reference logic
class ApiKeyRotator {
  constructor() {
    this.keys = process.env.ASSEMBLYAI_API_KEYS?.split(',').map(k => k.trim()) || [];
    this.currentIndex = 0;
  }

  getNextClient() {
    if (this.keys.length === 0) {
      throw new Error('No API keys found in .env (ASSEMBLYAI_API_KEYS)');
    }
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return new AssemblyAI({ apiKey: key });
  }

  getKeyCount() {
    return this.keys.length;
  }
}

const rotator = new ApiKeyRotator();

const DEFAULT_MR_OWI_TIPS = {
  artikulasi: [
    'Hindari menelan akhir kata atau berbicara terlalu cepat sehingga pengucapan terdengar samar.',
    'Gerakan mulut yang jelas membantu suara terdengar lebih tegas dan mudah dipahami.',
    'Ulangi kata atau istilah penting beberapa kali agar lidah terbiasa dan tidak terbata-bata saat menyampaikannya.'
  ],
  intonasi: [
    'Beri penekanan pada kata atau poin penting agar pesan lebih jelas dan tidak terdengar datar.',
    'Variasikan nada saat menjelaskan bagian penting atau saat berpindah topik agar penyampaian lebih hidup. Hindari nada monoton.',
    'Jangan berbicara dengan satu nada terus-menerus, karena dapat membuat audiens cepat bosan atau kehilangan fokus.'
  ],
  kata_jeda: [
    'Saat butuh waktu berpikir, lebih baik berhenti sejenak daripada mengisi dengan kata pengisi. Diam singkat terlihat lebih percaya diri.',
    'Siapkan penghubung seperti "selanjutnya" atau "berikutnya" agar alur bicara lebih terstruktur dan tidak terputus-putus.',
    'Dengarkan kembali rekaman presentasi untuk menyadari seberapa sering filler muncul, lalu perbaiki secara bertahap.'
  ],
  pemborosan_kata: [
    'Hindari penggunaan ganda seperti "sangat sekali", "benar-benar sangat", atau "agar supaya". Pilih salah satu yang paling kuat.',
    'Hindari pengulangan makna dalam satu kalimat. Jika pesan sudah jelas, tidak perlu ditambah kata yang hanya memperpanjang tanpa menambah arti.'
  ]
};

const SINGLE_WORD_FILLERS = new Set([
  'e',
  'ee',
  'eee',
  'eeee',
  'eh',
  'em',
  'emm',
  'emmm',
  'hm',
  'hmm',
  'hmmm',
  'mmm',
  'um',
  'umm',
  'uh',
  'anu',
  'anuu',
  'nah',
  'jadi',
  'terus',
  'kayak',
  'gitu',
  'tuh',
  'ya',
  'kan',
]);

const PHRASE_FILLERS = [
  ['apa', 'ya'],
  ['apa', 'namanya'],
  ['apa', 'tuh'],
  ['apa', 'itu'],
  ['gimana', 'ya'],
  ['ini', 'tuh'],
  ['itu', 'tuh'],
  ['yang', 'kayak'],
  ['kayak', 'gitu'],
].sort((a, b) => b.length - a.length);

const REDUNDANT_PHRASES = [
  ['sangat', 'sekali'],
  ['amat', 'sangat'],
  ['paling', 'terbaik'],
  ['agar', 'supaya'],
  ['demi', 'untuk'],
  ['adalah', 'merupakan'],
  ['naik', 'ke', 'atas'],
  ['turun', 'ke', 'bawah'],
  ['masuk', 'ke', 'dalam'],
  ['keluar', 'ke', 'luar'],
  ['maju', 'ke', 'depan'],
  ['mundur', 'ke', 'belakang'],
  ['kembali', 'lagi'],
  ['ulang', 'kembali'],
  ['mengulang', 'kembali'],
  ['sejak', 'dari'],
  ['para', 'hadirin', 'sekalian'],
  ['para', 'teman', 'teman', 'sekalian'],
  ['hadirin', 'sekalian'],
].sort((a, b) => b.length - a.length);

function normalizeTipList(value, fallback) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);

  return cleaned.length > 0 ? cleaned : fallback;
}

function normalizeMrOwiTips(tips = {}) {
  return {
    artikulasi: normalizeTipList(tips.artikulasi, DEFAULT_MR_OWI_TIPS.artikulasi),
    intonasi: normalizeTipList(tips.intonasi, DEFAULT_MR_OWI_TIPS.intonasi),
    kata_jeda: normalizeTipList(tips.kata_jeda, DEFAULT_MR_OWI_TIPS.kata_jeda),
    pemborosan_kata: normalizeTipList(tips.pemborosan_kata, DEFAULT_MR_OWI_TIPS.pemborosan_kata)
  };
}

function statusFromScore(score) {
  if (score >= 80) return 'good';
  if (score >= 60) return 'warning';
  return 'bad';
}

function formatDuration(seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

function tempoLabelFromWpm(wpm) {
  if (wpm < 100) return 'slow';
  if (wpm > 160) return 'fast';
  return 'normal';
}

function buildTempoTimeline(wordTimings = [], durationSeconds = 1, fallbackWpm = 0) {
  const safeDuration = Math.max(Math.round(Number(durationSeconds) || 1), 1);
  const validWords = Array.isArray(wordTimings)
    ? wordTimings.filter(word =>
        Number.isFinite(Number(word.startSecond)) &&
        Number(word.startSecond) >= 0 &&
        String(word.text || '').trim().length > 0
      )
    : [];

  if (validWords.length === 0) {
    const safeWpm = Math.max(Math.round(Number(fallbackWpm) || 0), 0);
    return {
      chart: safeWpm > 0
        ? [
            { second: Math.round(safeDuration * 0.33), wpm: safeWpm },
            { second: Math.round(safeDuration * 0.66), wpm: safeWpm },
            { second: safeDuration, wpm: safeWpm }
          ]
        : [],
      segments: safeWpm > 0
        ? [
            {
              startSecond: 0,
              endSecond: safeDuration,
              label: tempoLabelFromWpm(safeWpm),
              wpm: safeWpm
            }
          ]
        : []
    };
  }

  const windowSeconds = safeDuration <= TEMPO_WINDOW_SECONDS
    ? safeDuration
    : TEMPO_WINDOW_SECONDS;
  const segments = [];

  for (let start = 0; start < safeDuration; start += windowSeconds) {
    const end = Math.min(start + windowSeconds, safeDuration);
    const seconds = Math.max(end - start, 1);
    const wordCount = validWords.filter(word =>
      Number(word.startSecond) >= start && Number(word.startSecond) < end
    ).length;
    const wpm = Math.round((wordCount / seconds) * 60);

    segments.push({
      startSecond: start,
      endSecond: end,
      label: tempoLabelFromWpm(wpm),
      wpm
    });
  }

  return {
    chart: segments.map(segment => ({
      second: segment.endSecond,
      wpm: segment.wpm
    })),
    segments
  };
}

function normalizeVolumeForChart(volume) {
  const numericVolume = Number(volume);
  if (!Number.isFinite(numericVolume)) return null;
  return Math.max(0, Math.min(100, Math.round(((numericVolume + 60) / 60) * 100)));
}

function buildIntonationChart(volumeHistory = [], durationSeconds = 1) {
  if (!Array.isArray(volumeHistory) || volumeHistory.length === 0) return [];

  const safeDuration = Math.max(Math.round(Number(durationSeconds) || 1), 1);
  const maxPoints = 28;
  const sampleSize = Math.max(1, Math.ceil(volumeHistory.length / maxPoints));
  const sampled = [];

  for (let index = 0; index < volumeHistory.length; index += sampleSize) {
    const chunk = volumeHistory.slice(index, index + sampleSize);
    const normalizedChunk = chunk
      .map(normalizeVolumeForChart)
      .filter(Number.isFinite);

    if (normalizedChunk.length === 0) continue;

    const value = Math.round(
      normalizedChunk.reduce((sum, item) => sum + item, 0) / normalizedChunk.length,
    );
    const second = Math.min(
      safeDuration,
      Math.round(((index + chunk.length) / volumeHistory.length) * safeDuration),
    );

    sampled.push({ second, value });
  }

  return sampled;
}

function normalizeWordTiming(word) {
  const startSecond = Number.isFinite(Number(word?.start))
    ? Number(word.start) / 1000
    : Number(word?.startSecond);
  const endSecond = Number.isFinite(Number(word?.end))
    ? Number(word.end) / 1000
    : Number(word?.endSecond);
  const text = String(word?.text || '').trim();

  if (!text || !Number.isFinite(startSecond)) return null;

  return {
    text,
    startSecond: Math.max(0, Number(startSecond.toFixed(2))),
    endSecond: Number.isFinite(endSecond)
      ? Math.max(0, Number(endSecond.toFixed(2)))
      : undefined,
    confidence: Number.isFinite(Number(word?.confidence))
      ? Number(word.confidence)
      : undefined,
  };
}

function extractWordTimings(transcript) {
  const fromUtterances = Array.isArray(transcript?.utterances)
    ? transcript.utterances
        .filter(u => u.speaker === 'A' || u.speaker === 0 || u.speaker === '1')
        .flatMap(u => Array.isArray(u.words) ? u.words : [])
    : [];
  const rawWords = fromUtterances.length > 0
    ? fromUtterances
    : Array.isArray(transcript?.words)
      ? transcript.words
      : [];

  return rawWords
    .map(normalizeWordTiming)
    .filter(Boolean);
}

function normalizeTranscriptWord(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function tokenizeTranscript(transcriptText = '') {
  return transcriptText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function detectFillerWords(words = []) {
  const fillerWords = [];
  const phraseIndexes = new Set();

  for (let index = 0; index < words.length; index += 1) {
    const phrase = PHRASE_FILLERS.find(candidate =>
      candidate.every((word, offset) => words[index + offset] === word)
    );

    if (!phrase) continue;

    fillerWords.push(phrase.join(' '));
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

function detectPhraseMatches(words = [], phrasePatterns = []) {
  const matches = [];

  for (let index = 0; index < words.length; index += 1) {
    const phrase = phrasePatterns.find(candidate =>
      candidate.every((word, offset) => words[index + offset] === word)
    );

    if (!phrase) continue;

    matches.push(phrase.join(' '));
    index += phrase.length - 1;
  }

  return matches;
}

function detectWordWaste(words = []) {
  const wastePhrases = [];

  for (let index = 1; index < words.length; index += 1) {
    if (words[index] === words[index - 1]) {
      wastePhrases.push(`${words[index - 1]} ${words[index]}`);
    }
  }

  return [...wastePhrases, ...detectPhraseMatches(words, REDUNDANT_PHRASES)];
}

function isAcousticFillerWord(word = '') {
  return (
    /^e+h?$/.test(word) ||
    /^e+m+$/.test(word) ||
    /^e+u+m+$/.test(word) ||
    /^u+h+$/.test(word) ||
    /^u+m+$/.test(word) ||
    /^h+m+$/.test(word) ||
    /^m{2,}$/.test(word)
  );
}

function isUnclearToken(word = '') {
  const normalized = normalizeTranscriptWord(word);
  if (!normalized || SINGLE_WORD_FILLERS.has(normalized) || isAcousticFillerWord(normalized)) {
    return false;
  }

  return (
    (normalized.length >= 4 && !/[aiueo]/.test(normalized)) ||
    (normalized.length >= 5 && /(.)\1{3,}/.test(normalized))
  );
}

function detectUnclearSegments(transcriptText = '', wordTimings = []) {
  const timedSegments = Array.isArray(wordTimings)
    ? wordTimings
        .filter(word => {
          const text = String(word?.text || '').trim();
          const confidence = Number(word?.confidence);
          return (
            isUnclearToken(text) ||
            (Number.isFinite(confidence) && confidence < 0.55 && normalizeTranscriptWord(text).length >= 3)
          );
        })
        .map(word => ({
          startSecond: Math.max(0, Math.round(Number(word.startSecond) || 0)),
          endSecond: Math.max(
            Math.round(Number(word.startSecond) || 0),
            Math.round(Number(word.endSecond) || Number(word.startSecond) || 0),
          ),
          text: String(word.text || '').trim(),
          confidence: Number.isFinite(Number(word.confidence)) ? Number(word.confidence) : undefined,
        }))
    : [];

  if (timedSegments.length > 0) return timedSegments;

  return tokenizeTranscript(transcriptText)
    .filter(isUnclearToken)
    .map(word => ({
      startSecond: 0,
      endSecond: 0,
      text: word,
    }));
}

function analyzeTranscriptLocally(transcriptText = '') {
  const words = tokenizeTranscript(transcriptText);
  const fillerWords = detectFillerWords(words);
  const wordWaste = detectWordWaste(words);

  return {
    filler_words: fillerWords,
    filler_count: fillerWords.length,
    repeated_words: wordWaste,
    total_words: words.length,
  };
}

function buildTranscriptTokens(transcriptText, fillerWords = [], repeatedWords = []) {
  const fillerSet = new Set(
    fillerWords
      .map(word => String(word).toLowerCase())
      .filter(word => !word.includes(' '))
  );
  const fillerPhrases = fillerWords
    .map(word => String(word).toLowerCase().split(/\s+/).filter(Boolean))
    .filter(words => words.length > 1);
  const repeatedSet = new Set(
    repeatedWords
      .map(word => String(word).toLowerCase())
      .filter(word => !word.includes(' '))
  );
  const repeatedPhrases = repeatedWords
    .map(word => String(word).toLowerCase().split(/\s+/).filter(Boolean))
    .filter(words => words.length > 1);
  const rawTokens = transcriptText.split(/\s+/).filter(Boolean);
  const normalizedTokens = rawTokens.map(normalizeTranscriptWord);
  const fillerTokenIndexes = new Set();
  const wasteTokenIndexes = new Set();

  for (let index = 0; index < normalizedTokens.length; index += 1) {
    const phrase = fillerPhrases.find(candidate =>
      candidate.every((word, offset) => normalizedTokens[index + offset] === word)
    );

    if (!phrase) continue;

    phrase.forEach((_, offset) => fillerTokenIndexes.add(index + offset));
    index += phrase.length - 1;
  }

  for (let index = 0; index < normalizedTokens.length; index += 1) {
    const phrase = repeatedPhrases.find(candidate =>
      candidate.every((word, offset) => normalizedTokens[index + offset] === word)
    );

    if (!phrase) continue;

    phrase.forEach((_, offset) => wasteTokenIndexes.add(index + offset));
    index += phrase.length - 1;
  }

  return rawTokens
    .map((text, index) => {
      const normalized = normalizedTokens[index];
      const tags = [];
      if (fillerSet.has(normalized) || fillerTokenIndexes.has(index)) tags.push('filler');
      if (repeatedSet.has(normalized) || wasteTokenIndexes.has(index)) tags.push('waste');
      return { text, tags };
    });
}

function countWords(items = []) {
  return items.reduce((acc, word) => {
    const key = String(word).toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildPresentationEvaluation({
  sessionId,
  transcriptText,
  duration,
  analysis,
  telemetry,
  mrOwiTips,
  wordTimings = [],
}) {
  const fillerWords = analysis.filler_words || [];
  const repeatedWords = analysis.repeated_words || [];
  const fillerCount = analysis.filler_count || fillerWords.length;
  const totalWords = analysis.total_words || transcriptText.split(/\s+/).filter(Boolean).length;
  const durationSeconds = Math.max(Number(duration) || 1, 1);
  const averageWpm = Math.round((totalWords / durationSeconds) * 60);
  const fillerScore = Math.max(0, 100 - fillerCount * 5);
  const wordWasteScore = Math.max(0, 100 - repeatedWords.length * 6);
  const unclearSegments = detectUnclearSegments(transcriptText, wordTimings);
  const articulationScore = Math.max(0, 100 - unclearSegments.length * 8);
  const eyeContact = telemetry?.eyeContact;
  const intonationTelemetry = telemetry?.intonation;
  const intonationChart = buildIntonationChart(
    intonationTelemetry?.volumeHistory,
    durationSeconds,
  );
  const eyeScore = eyeContact?.focusScore ?? 0;
  const fillerCountMap = countWords(fillerWords);
  const fillerSummary = Object.entries(fillerCountMap).map(([word, count]) => ({ word, count }));
  const topFillers = fillerSummary.slice(0, 2).map(item => `"${item.word}"`).join(' dan ');
  const transcript = buildTranscriptTokens(transcriptText, fillerWords, repeatedWords);
  const tempoLabel = averageWpm < 100 ? 'slow' : averageWpm > 160 ? 'fast' : 'normal';
  const tempoTimeline = buildTempoTimeline(wordTimings, durationSeconds, averageWpm);

  return {
    sessionId,
    overallScore: analysis.overall_score || 0,
    transcriptText,
    createdAt: new Date().toISOString(),
    summary: [
      {
        id: 'intonation',
        title: 'Intonasi',
        score: analysis.overall_score || 0,
        status: statusFromScore(analysis.overall_score || 0),
        evaluationNote: 'Intonasi dievaluasi dari kelancaran audio dan variasi penyampaian selama presentasi.'
      },
      {
        id: 'eyeContact',
        title: 'Kontak Mata',
        score: eyeScore,
        status: eyeContact ? statusFromScore(eyeScore) : 'unavailable',
        evaluationNote: eyeContact
          ? `Kontak mata terjaga selama ${formatDuration(eyeContact.focusDuration)}, dengan ${formatDuration(eyeContact.unfocusDuration)} momen tidak fokus.`
          : 'Data kontak mata belum tersedia karena tracking wajah tidak aktif selama sesi.'
      },
      {
        id: 'tempo',
        title: 'Tempo',
        score: statusFromScore(averageWpm >= 100 && averageWpm <= 160 ? 90 : 65) === 'good' ? 90 : 65,
        status: averageWpm >= 100 && averageWpm <= 160 ? 'good' : 'warning',
        evaluationNote: `Tempo bicara berada di ${averageWpm} kata per menit dan tergolong ${tempoLabel === 'normal' ? 'stabil' : tempoLabel === 'fast' ? 'cepat' : 'lambat'}.`
      },
      {
        id: 'fillerWords',
        title: 'Kata Jeda',
        score: fillerScore,
        status: statusFromScore(fillerScore),
        evaluationNote: fillerCount > 0
          ? `Terdapat filler word seperti ${topFillers || 'kata jeda'} sebanyak ${fillerCount} kali saat presentasi.`
          : 'Tidak ditemukan kata jeda yang mengganggu selama presentasi.'
      },
      {
        id: 'articulation',
        title: 'Artikulasi',
        score: articulationScore,
        status: statusFromScore(articulationScore),
        evaluationNote: unclearSegments.length > 0
          ? `Terdapat ${unclearSegments.length} kata atau bunyi yang kurang jelas dan berpotensi tidak bermakna dalam transcript.`
          : 'Tidak ditemukan kata tidak bermakna yang menonjol pada transcript.'
      },
      {
        id: 'wordWaste',
        title: 'Pemborosan Kata',
        score: wordWasteScore,
        status: statusFromScore(wordWasteScore),
        evaluationNote: repeatedWords.length > 0
          ? `Terdapat ${repeatedWords.length} frasa redundan atau pengulangan yang berpotensi membuat penyampaian kurang ringkas.`
          : 'Tidak ditemukan pemborosan kata yang menonjol pada transcript.'
      }
    ],
    details: {
      intonation: {
        chart: intonationChart,
        metrics: {
          averageVolume: intonationTelemetry?.averageVolume,
          monotoneLevel: intonationTelemetry?.monotoneLevel,
        },
        aiTips: mrOwiTips.intonasi
      },
      eyeContact: {
        events: eyeContact?.events || [],
        focusDuration: eyeContact?.focusDuration || 0,
        unfocusDuration: eyeContact?.unfocusDuration || 0,
        aiTips: [
          'Arahkan wajah ke kamera saat menyampaikan poin utama.',
          'Gunakan catatan singkat agar tidak terlalu sering melihat ke luar kamera.'
        ]
      },
      tempo: {
        chart: tempoTimeline.chart,
        averageWpm,
        segments: tempoTimeline.segments,
        aiTips: [
          'Jaga tempo di kisaran 100 sampai 160 kata per menit.',
          'Tambahkan jeda singkat setelah menyampaikan poin penting.'
        ]
      },
      fillerWords: {
        transcript,
        fillerWords: fillerSummary,
        totalCount: fillerCount,
        aiTips: mrOwiTips.kata_jeda
      },
      articulation: {
        unclearSegments,
        aiTips: mrOwiTips.artikulasi
      },
      wordWaste: {
        transcript,
        wastedPhrases: repeatedWords.map(word => ({
          text: word,
          reason: 'Bagian ini terdeteksi sebagai pengulangan atau redundansi makna yang membuat kalimat kurang efisien.'
        })),
        aiTips: mrOwiTips.pemborosan_kata
      }
    }
  };
}

async function upsertFeedback(feedbackData) {
  const { data, error } = await supabaseAdmin
    .from('feedbacks')
    .upsert(feedbackData, { onConflict: 'session_id' })
    .select()
    .single();

  return { data, error };
}

// Logika pemrosesan audio latar belakang yang sebelumnya ada di API 2
export const runBackgroundAudioProcessing = async ({ sessionId, audioUrl, duration, telemetry }) => {
  console.log(`[runBackgroundAudioProcessing] Started background processing for session: ${sessionId}`);

  let transcriptText = '';
  let transcribed = false;
  let wordTimings = [];

  // ============================================================
  // TAHAP 1: SPEECH-TO-TEXT DENGAN ASSEMBLYAI & SIMPAN TRANSKRIP
  // ============================================================
  try {
    const keyCount = rotator.getKeyCount();

    for (let attempt = 0; attempt < keyCount; attempt++) {
      const client = rotator.getNextClient();
      try {
        console.log(`[AssemblyAI] Attempting transcription with Key #${attempt + 1}`);
        const transcript = await client.transcripts.transcribe({
          audio: audioUrl,
          speech_models: ['universal-3-pro', 'universal-2'],
          disfluencies: true,
          language_detection: true,
          speaker_labels: true,
          punctuate: true,
          format_text: true,
        });

        // Parse speaker text
        if (transcript.utterances?.length > 0) {
          transcript.utterances.forEach(u => {
            if (u.speaker === 'A' || u.speaker === 0 || u.speaker === '1') {
              transcriptText += u.text + '\n';
            }
          });
        } else {
          transcriptText = transcript.text || '';
        }
        wordTimings = extractWordTimings(transcript);

        transcribed = true;
        console.log(`[AssemblyAI] Transcription successful.`);
        break; // Stop attempting if successful
      } catch (error) {
        console.error(`[AssemblyAI] Error with Key #${attempt + 1}:`, error.message);
        const isRateLimit = error.message.includes('429') ||
                            error.message.toLowerCase().includes('rate limit') ||
                            error.message.toLowerCase().includes('concurrency');
        
        if (isRateLimit && attempt < keyCount - 1) {
          console.log('[AssemblyAI] Rate limit detected, rotating to next API key...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else if (!isRateLimit) {
            throw error; // Fail fast if it's not a rate limit issue
        }
      }
    }

    if (!transcribed) {
      throw new Error('All AssemblyAI API keys failed to process the audio');
    }

    transcriptText = transcriptText.trim();

    // ============================================
    // STEP 2: SAVE RAW TRANSCRIPT TO SUPABASE IMMEDIATELY
    // ============================================
    const { error: updateError } = await supabaseAdmin
      .from('audio_recordings')
      .update({
        transcript: transcriptText,
        word_timings: wordTimings,
        is_processed: true,
        processing_status: 'completed',
        processed_at: new Date(),
      })
      .eq('session_id', sessionId);

    if (updateError) {
      console.warn('[Supabase] Failed to update audio_recordings:', updateError.message);
      throw updateError;
    }

    console.log(`[Supabase] Raw transcript saved successfully for session ${sessionId}`);

  } catch (error) {
    console.error(`[runBackgroundAudioProcessing] Fatal speech-to-text error for session ${sessionId}:`, error);
    
    // Mark as failed in audio_recordings
    await supabaseAdmin
      .from('audio_recordings')
      .update({ processing_status: 'failed' })
      .eq('session_id', sessionId);

    // Mark as failed in game_sessions
    await supabaseAdmin
      .from('game_sessions')
      .update({ status: 'failed' })
      .eq('id', sessionId);

    return; // Keluar lebih awal karena transkripsi gagal
  }

  // ============================================================
  // TAHAP 2: FEEDBACK ANALYSIS DENGAN GROQ AI
  // ============================================================
  try {
    let finalScore = 0;

    // ============================================
    // STEP 3: ANALYZE WITH GROQ AI OR HANDLE SILENCE
    // ============================================
    if (transcriptText.length > 0) {
      console.log(`[Groq] Starting analysis...`);

      const groqPrompt = `
      Anda adalah seorang ahli komunikasi dan pelatih public speaking. Analisis transkripsi berikut.
      Tugas Anda:
      1. Hitung dan deteksi "filler words" Bahasa Indonesia yang lazim muncul di lapangan.
         Contoh kuat: "e", "ee", "eee", "eh", "em", "emm", "hm", "hmm", "mmm", "um", "uh", "anu".
         Contoh pengisi wacana saat berlebihan: "nah", "jadi", "terus", "kayak", "gitu", "tuh", "ya", "kan".
         Contoh frasa filler: "apa ya", "apa namanya", "apa tuh", "apa itu", "gimana ya", "ini tuh", "itu tuh", "kayak gitu".
         Jangan menandai kata formal yang memang bermakna seperti "seperti" sebagai filler word.
      2. Analisis tingkat kelancaran berbicara (apakah ada ketidaklancaran/gagap).
         Untuk pemborosan kata, prioritaskan redundansi makna seperti "sangat sekali", "agar supaya", "naik ke atas", "turun ke bawah", "masuk ke dalam", "keluar ke luar", "kembali lagi", "adalah merupakan", serta pengulangan langsung seperti "saya saya".
      3. Berikan rekomendasi/referensi kata alternatif yang lebih baik untuk menggantikan kata-kata yang kurang tepat.
      4. Berikan total jumlah kata dan skor keseluruhan (0-100).
      5. Wajib keluarkan 4 output teks tips "Tips dari Mr Owi":
         - artikulasi: tips agar pengucapan lebih jelas seperti contoh kartu artikulasi.
         - intonasi: tips agar nada suara tidak monoton seperti contoh kartu intonasi.
         - kata_jeda: tips untuk mengurangi filler words/kata jeda.
         - pemborosan_kata: tips untuk mengurangi kata berlebihan atau pengulangan makna.
      Setiap kategori tips berisi 2-3 kalimat singkat dalam Bahasa Indonesia.
      
      Output harus dalam format JSON yang valid dengan struktur berikut:
      {
        "filler_words": ["eh", "hmm", "apa ya"],
        "filler_count": 2,
        "repeated_words": ["sangat sekali", "saya saya"],
        "total_words": 100,
        "overall_score": 85,
        "summary": "Ringkasan evaluasi...",
        "improvement_tips": "Saran perbaikan...",
        "mr_owi_tips": {
          "artikulasi": [
            "Hindari menelan akhir kata atau berbicara terlalu cepat sehingga pengucapan terdengar samar.",
            "Gerakan mulut yang jelas membantu suara terdengar lebih tegas dan mudah dipahami.",
            "Ulangi kata atau istilah penting beberapa kali agar lidah terbiasa dan tidak terbata-bata saat menyampaikannya."
          ],
          "intonasi": [
            "Beri penekanan pada kata atau poin penting agar pesan lebih jelas dan tidak terdengar datar.",
            "Variasikan nada saat menjelaskan bagian penting atau saat berpindah topik agar penyampaian lebih hidup. Hindari nada monoton.",
            "Jangan berbicara dengan satu nada terus-menerus, karena dapat membuat audiens cepat bosan atau kehilangan fokus."
          ],
          "kata_jeda": [
            "Saat butuh waktu berpikir, lebih baik berhenti sejenak daripada mengisi dengan kata pengisi.",
            "Siapkan penghubung seperti selanjutnya atau berikutnya agar alur bicara lebih terstruktur.",
            "Dengarkan kembali rekaman presentasi untuk menyadari seberapa sering filler muncul."
          ],
          "pemborosan_kata": [
            "Hindari penggunaan ganda seperti sangat sekali, agar supaya, atau naik ke atas.",
            "Hindari pengulangan makna dalam satu kalimat jika pesan sudah jelas."
          ]
        },
        "vocabulary_references": [
          {"original": "kayak", "suggestion": "seperti"},
          {"original": "anu", "suggestion": "(hapus kata ini atau ganti dengan jeda diam)"}
        ]
      }
      Jangan kembalikan apapun selain JSON.
      `;

      const groqKeyCount = groqRotator.getKeyCount();
      let aiResponse;
      let groqAnalyzed = false;

      for (let attempt = 0; attempt < groqKeyCount; attempt++) {
        const groqClient = groqRotator.getNextClient();
        try {
          console.log(`[Groq] Attempting analysis with Key #${attempt + 1}`);
          aiResponse = await groqClient.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: groqPrompt },
              { role: "user", content: transcriptText }
            ],
            temperature: 0,
            response_format: { type: "json_object" }
          });
          groqAnalyzed = true;
          console.log(`[Groq] Analysis successful.`);
          break; // Stop attempting if successful
        } catch (error) {
          console.error(`[Groq] Error with Key #${attempt + 1}:`, error.message);
          const isRateLimit = error.message.includes('429') ||
                              error.message.toLowerCase().includes('rate limit') ||
                              error.message.toLowerCase().includes('concurrency');

          if (isRateLimit && attempt < groqKeyCount - 1) {
            console.log('[Groq] Rate limit detected, rotating to next API key...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else if (!isRateLimit) {
              throw error; // Fail fast if it's not a rate limit issue
          }
        }
      }

      if (!groqAnalyzed || !aiResponse) {
        throw new Error('All Groq API keys failed to process the audio');
      }

      const analysisText = aiResponse.choices[0].message.content;
      let analysis = {};
      try {
        analysis = JSON.parse(analysisText);
      } catch (e) {
        console.error('[Groq] Failed to parse AI response:', analysisText);
        analysis = { summary: 'Gagal memproses hasil analisis AI.' };
      }

      const transcriptAnalysis = analyzeTranscriptLocally(transcriptText);
      analysis.filler_words = transcriptAnalysis.filler_words;
      analysis.filler_count = transcriptAnalysis.filler_count;
      analysis.repeated_words = transcriptAnalysis.repeated_words;
      analysis.total_words = transcriptAnalysis.total_words;

      finalScore = analysis.overall_score || 0;
      const mrOwiTips = normalizeMrOwiTips(analysis.mr_owi_tips);
      const evaluation = buildPresentationEvaluation({
        sessionId,
        transcriptText,
        duration,
        analysis,
        telemetry,
        mrOwiTips,
        wordTimings
      });

      // ============================================
      // STEP 4: SAVE FEEDBACK TO SUPABASE
      // ============================================
      const feedbackData = {
        session_id: sessionId,
        overall_score: finalScore,
        summary: analysis.summary || 'Presentasi selesai dianalisis.',
        improvement_tips: analysis.improvement_tips || 'Terus berlatih untuk hasil yang lebih baik.',
        evaluation_json: evaluation,
        total_words: analysis.total_words || transcriptText.split(' ').length,
        eye_score: evaluation.summary.find(s => s.id === 'eyeContact')?.score ?? 0,
        voice_score: evaluation.summary.find(s => s.id === 'intonation')?.score ?? 0,
        filler_score: Math.max(0, 100 - (analysis.filler_count || 0) * 5),
        content_score: 0,
        confidence_score: 0,
        word_waste_score: evaluation.summary.find(s => s.id === 'wordWaste')?.score ?? 0,
        articulation_score: evaluation.summary.find(s => s.id === 'articulation')?.score ?? 0,
        focus_duration: evaluation.details.eyeContact.focusDuration,
        unfocus_duration: evaluation.details.eyeContact.unfocusDuration,
        avg_volume: null,
        tempo: evaluation.details.tempo.averageWpm,
        wpm: evaluation.details.tempo.averageWpm,
        mr_owi_tips: analysis.mr_owi_tips || null,
        vocabulary_references: analysis.vocabulary_references || null,
      };

      // Upsert feedback
      const { data: feedback, error: feedbackError } = await upsertFeedback(feedbackData);

      if (feedbackError) {
        console.warn('[Supabase] Failed to save feedback:', feedbackError.message);
      } else {
        console.log(`[Supabase] Feedback saved successfully for session ${sessionId}`);
        
        // Simpan word waste ke tabel database feedback_repeated_words.
        if (analysis.repeated_words && Array.isArray(analysis.repeated_words) && analysis.repeated_words.length > 0 && feedback) {
          const wordsList = tokenizeTranscript(transcriptText);
          
          const repeatedWordsData = analysis.repeated_words.map(word => {
            const wasteTokens = String(word).toLowerCase().split(/\s+/).filter(Boolean);
            let occurrences = 0;

            for (let index = 0; index < wordsList.length; index += 1) {
              const isMatch = wasteTokens.every((token, offset) => wordsList[index + offset] === token);
              if (isMatch) occurrences += 1;
            }

            return {
              feedback_id: feedback.id,
              word: word,
              count: occurrences || 1
            };
          });

          // Hapus repeated words lama untuk feedback ini agar tidak melanggar constraint/duplicate insert
          await supabaseAdmin
            .from('feedback_repeated_words')
            .delete()
            .eq('feedback_id', feedback.id);

          const { error: wordsError } = await supabaseAdmin
            .from('feedback_repeated_words')
            .insert(repeatedWordsData);

          if (wordsError) {
            console.warn('[Supabase] Failed to save repeated words:', wordsError.message);
          } else {
            console.log('[Supabase] Repeated words saved successfully');
          }
        }
      }
    } else {
      console.log(`[Groq] Transcript was empty, skipping analysis. Generating default feedback.`);
      finalScore = 0;

      const defaultMrOwiTips = normalizeMrOwiTips();
      const defaultImprovementTips = 'Silakan coba berbicara lebih keras atau periksa mikrofon Anda.';
      
      const analysis = {
        overall_score: 0,
        filler_words: [],
        filler_count: 0,
        repeated_words: [],
        total_words: 0,
        summary: 'Tidak ada suara atau percakapan yang terdeteksi pada rekaman audio.',
        improvement_tips: defaultImprovementTips
      };

      const evaluation = buildPresentationEvaluation({
        sessionId,
        transcriptText: '',
        duration,
        telemetry,
        analysis,
        mrOwiTips: defaultMrOwiTips,
        wordTimings: []
      });

      const feedbackData = {
        session_id: sessionId,
        overall_score: 0,
        summary: 'Tidak ada suara atau percakapan yang terdeteksi pada rekaman audio.',
        improvement_tips: defaultImprovementTips,
        evaluation_json: evaluation,
        total_words: 0,
        eye_score: evaluation.summary.find(s => s.id === 'eyeContact')?.score ?? 0,
        voice_score: 0,
        filler_score: 100, // Default to good score if no fillers detected (no transcript)
        content_score: 0,
        confidence_score: 0,
        word_waste_score: 100, // Default to good score if no wasted words (no transcript)
        articulation_score: 0,
        focus_duration: evaluation.details.eyeContact.focusDuration,
        unfocus_duration: evaluation.details.eyeContact.unfocusDuration,
        avg_volume: null,
        tempo: 0,
        wpm: 0,
        mr_owi_tips: defaultMrOwiTips || null,
        vocabulary_references: [],
      };

      const { error: feedbackError } = await upsertFeedback(feedbackData);

      if (feedbackError) {
        console.warn('[Supabase] Failed to save default feedback:', feedbackError.message);
      }
    }

    // ============================================
    // STEP 5: SYNC GAME SESSIONS STATUS TO COMPLETED
    // ============================================
    const { error: sessionSuccessError } = await supabaseAdmin
      .from('game_sessions')
      .update({
        status: 'completed',
        total_score: finalScore
      })
      .eq('id', sessionId);

    if (sessionSuccessError) {
      console.warn('[Supabase] Failed to update game_sessions status to completed:', sessionSuccessError.message);
    } else {
      console.log(`[Supabase] Game session ${sessionId} marked as completed`);
    }

    console.log(`[runBackgroundAudioProcessing] Finished processing for session: ${sessionId}`);

  } catch (groqError) {
    console.error(`[runBackgroundAudioProcessing] Non-fatal Groq AI feedback error for session ${sessionId}:`, groqError);
    
    // Jika Groq gagal, kita tetap ubah status game_session menjadi failed, namun audio_recording tetap completed (sukses transkrip)
    await supabaseAdmin
      .from('game_sessions')
      .update({ status: 'failed' })
      .eq('id', sessionId);
  }
};
