import { supabaseAdmin } from '../config/supabase.js'
const TEMPO_WINDOW_SECONDS = 10

const verifySessionOwnership = async (sessionId, userId) => {
    const { data } = await supabaseAdmin
        .from('game_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle()
    return data
}

// ================================
// GAME SESSIONS
// ================================

export const createSession = async (req, res) => {
    try {
        const { duration } = req.body
        if (!duration) return res.status(400).json({ error: 'Duration wajib diisi' })

        const { data, error } = await supabaseAdmin
            .from('game_sessions')
            .insert({ user_id: req.user.id, duration, status: 'recording' })
            .select()
            .single()

        if (error) throw error
        res.status(201).json({ message: 'Session started', session: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

export const getSessions = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('game_sessions')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })

        if (error) throw error
        res.json({ sessions: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

export const updateSessionStatus = async (req, res) => {
    try {
        const { id } = req.params
        const { status, total_score } = req.body

        const { data, error } = await supabaseAdmin
            .from('game_sessions')
            .update({ status, total_score })
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .maybeSingle()

        if (error) throw error
        if (!data) return res.status(404).json({ error: 'Session not found' })

        res.json({ message: 'Session updated', session: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// RECORDINGS
// ================================

export const postRecording = async (req, res) => {
    try {
        const { session_id, video_url, duration, transcript } = req.body

        const session = await verifySessionOwnership(session_id, req.user.id)
        if (!session) return res.status(404).json({ error: 'Session not found or forbidden' })

        let audioData, videoData;

        if (transcript) {
            const { data, error } = await supabaseAdmin
                .from('audio_recordings')
                .insert({ session_id, transcript })
                .select()
                .single()
            if (error) throw error
            audioData = data;
        }

        if (video_url) {
            const { data, error } = await supabaseAdmin
                .from('video_recordings')
                .insert({ session_id, video_url, duration: duration ?? 0 })
                .select()
                .single()
            if (error) throw error
            videoData = data;
        }

        res.status(201).json({ 
            message: 'Recording saved', 
            audio_recording: audioData,
            video_recording: videoData
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// FEEDBACKS
// ================================

export const postFeedback = async (req, res) => {
    try {
        const { 
            session_id, eye_score, voice_score, filler_score, content_score, confidence_score, overall_score, summary, improvement_tips,
            focus_duration, unfocus_duration, avg_volume, tempo, wpm, repeated_words, total_words
        } = req.body

        const session = await verifySessionOwnership(session_id, req.user.id)
        if (!session) return res.status(404).json({ error: 'Session not found or forbidden' })

        // Aturan default: string -> 'none', number -> 0
        const feedbackData = {
            session_id,
            eye_score: eye_score ?? 0,
            voice_score: voice_score ?? 0,
            filler_score: filler_score ?? 0,
            content_score: content_score ?? 0,
            confidence_score: confidence_score ?? 0,
            overall_score: overall_score ?? 0,
            summary: summary ?? 'none',
            improvement_tips: improvement_tips ?? 'none',
            focus_duration: focus_duration ?? 0,
            unfocus_duration: unfocus_duration ?? 0,
            avg_volume: avg_volume ?? 0,
            tempo: tempo ?? 0,
            wpm: wpm && wpm > 0 ? wpm : null,
            total_words: total_words ?? 0
        }

        const { data: feedback, error } = await supabaseAdmin
            .from('feedbacks')
            .insert(feedbackData)
            .select()
            .single()

        if (error) throw error

        // Handle repeated words ke tabel terpisah
        if (repeated_words && Array.isArray(repeated_words) && repeated_words.length > 0) {
            const wordCounts = {};
            repeated_words.forEach(word => {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            });
            const repeatedWordsData = Object.entries(wordCounts).map(([word, count]) => ({
                feedback_id: feedback.id,
                word,
                count
            }));

            const { error: wordsError } = await supabaseAdmin
                .from('feedback_repeated_words')
                .insert(repeatedWordsData)

            if (wordsError) throw wordsError
        }

        res.status(201).json({ message: 'Feedback saved', feedback })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
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

function buildTranscriptTokens(transcriptText, fillerWords = [], repeatedWords = []) {
  const fillerSet = new Set(fillerWords.map(word => String(word).toLowerCase()));
  const repeatedSet = new Set(repeatedWords.map(word => String(word).toLowerCase()));

  return (transcriptText || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(text => {
      const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      const tags = [];
      if (fillerSet.has(normalized)) tags.push('filler');
      if (repeatedSet.has(normalized)) tags.push('waste');
      return { text, tags };
    });
}

function tempoLabelFromWpm(wpm) {
  if (wpm < 100) return 'slow'
  if (wpm > 160) return 'fast'
  return 'normal'
}

function buildTempoTimeline(wordTimings = [], durationSeconds = 1, fallbackWpm = 0) {
  const safeDuration = Math.max(Math.round(Number(durationSeconds) || 1), 1)
  const validWords = Array.isArray(wordTimings)
    ? wordTimings.filter(word =>
        Number.isFinite(Number(word.startSecond)) &&
        Number(word.startSecond) >= 0 &&
        String(word.text || '').trim().length > 0
      )
    : []

  if (validWords.length === 0) {
    const safeWpm = Math.max(Math.round(Number(fallbackWpm) || 0), 0)
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
    }
  }

  const windowSeconds = safeDuration <= TEMPO_WINDOW_SECONDS
    ? safeDuration
    : TEMPO_WINDOW_SECONDS
  const segments = []

  for (let start = 0; start < safeDuration; start += windowSeconds) {
    const end = Math.min(start + windowSeconds, safeDuration)
    const seconds = Math.max(end - start, 1)
    const wordCount = validWords.filter(word =>
      Number(word.startSecond) >= start && Number(word.startSecond) < end
    ).length
    const wpm = Math.round((wordCount / seconds) * 60)

    segments.push({
      startSecond: start,
      endSecond: end,
      label: tempoLabelFromWpm(wpm),
      wpm
    })
  }

  return {
    chart: segments.map(segment => ({
      second: segment.endSecond,
      wpm: segment.wpm
    })),
    segments
  }
}

function chartLooksLikeFallback(chart = [], segments = []) {
  if (!Array.isArray(chart) || chart.length === 0) return true
  if (segments.length <= 1) return true

  const uniqueWpm = new Set(
    chart
      .map(point => Number(point?.wpm))
      .filter(Number.isFinite)
  )

  return chart.length <= 3 && uniqueWpm.size <= 1
}

function refreshTempoFromWordTimings(evaluation, audioRecording, sessionData, fallbackWpm = 0) {
  const wordTimings = Array.isArray(audioRecording?.word_timings)
    ? audioRecording.word_timings
    : []

  if (wordTimings.length === 0 || !evaluation?.details?.tempo) {
    return { evaluation, changed: false }
  }

  const focusDuration = Number(evaluation.details.eyeContact?.focusDuration) || 0
  const unfocusDuration = Number(evaluation.details.eyeContact?.unfocusDuration) || 0
  const durationSeconds = (focusDuration + unfocusDuration) > 0
    ? focusDuration + unfocusDuration
    : (sessionData?.duration ? sessionData.duration * 60 : 60)
  const tempo = evaluation.details.tempo

  if (!chartLooksLikeFallback(tempo.chart, tempo.segments)) {
    return { evaluation, changed: false }
  }

  const tempoTimeline = buildTempoTimeline(
    wordTimings,
    durationSeconds,
    tempo.averageWpm || fallbackWpm
  )

  return {
    evaluation: {
      ...evaluation,
      details: {
        ...evaluation.details,
        tempo: {
          ...tempo,
          chart: tempoTimeline.chart,
          segments: tempoTimeline.segments
        }
      }
    },
    changed: true
  }
}

function buildEvaluationJson(feedback, audioRecording, repeatedWordsData, sessionData) {
  const transcriptText = audioRecording?.transcript || '';
  const wordTimings = Array.isArray(audioRecording?.word_timings)
    ? audioRecording.word_timings
    : []
  const repeatedWords = (repeatedWordsData || []).map(r => r.word);
  
  const DEFAULT_FILLERS = ['eh', 'em', 'emm', 'hmm', 'anu'];
  const wordsList = transcriptText.toLowerCase().replace(/[.,!?;:"""''()[\]{}]/g, '').split(/\s+/).filter(Boolean);
  const foundFillers = wordsList.filter(w => DEFAULT_FILLERS.includes(w));
  const fillerCount = feedback.filler_score !== null ? Math.round((100 - feedback.filler_score) / 5) : foundFillers.length;
  
  const fillerWordsList = foundFillers.length > 0 ? [...new Set(foundFillers)] : DEFAULT_FILLERS;
  const fillerCounts = {};
  foundFillers.forEach(w => {
    fillerCounts[w] = (fillerCounts[w] || 0) + 1;
  });
  
  const fillerSummary = Object.entries(fillerCounts).map(([word, count]) => ({ word, count }));
  if (fillerSummary.length === 0 && fillerCount > 0) {
    fillerSummary.push({ word: 'eh', count: fillerCount });
    if (!fillerWordsList.includes('eh')) {
      fillerWordsList.push('eh');
    }
  }
  const topFillers = fillerSummary.slice(0, 2).map(item => `"${item.word}"`).join(' dan ');

  const totalWords = feedback.total_words || wordsList.length;
  const focusDuration = Number(feedback.focus_duration) || 0;
  const unfocusDuration = Number(feedback.unfocus_duration) || 0;
  const durationSeconds = (focusDuration + unfocusDuration) > 0 
    ? (focusDuration + unfocusDuration) 
    : (sessionData?.duration ? sessionData.duration * 60 : 60);

  const averageWpm = feedback.wpm || Math.round((totalWords / Math.max(durationSeconds, 1)) * 60);
  const tempoLabel = averageWpm < 100 ? 'slow' : averageWpm > 160 ? 'fast' : 'normal';
  const tempoTimeline = buildTempoTimeline(wordTimings, durationSeconds, averageWpm);

  const eyeScore = feedback.eye_score ?? 0;
  const intonationScore = feedback.voice_score ?? 0;
  const fillerScore = feedback.filler_score ?? 0;
  const wordWasteScore = feedback.word_waste_score ?? 0;
  const articulationScore = feedback.articulation_score ?? 0;

  const transcript = buildTranscriptTokens(transcriptText, fillerWordsList, repeatedWords);

  return {
    sessionId: feedback.session_id,
    overallScore: feedback.overall_score || 0,
    transcriptText,
    createdAt: feedback.created_at || new Date().toISOString(),
    summary: [
      {
        id: 'intonation',
        title: 'Intonasi',
        score: intonationScore,
        status: statusFromScore(intonationScore),
        evaluationNote: 'Intonasi dievaluasi dari kelancaran audio dan variasi penyampaian selama presentasi.'
      },
      {
        id: 'eyeContact',
        title: 'Kontak Mata',
        score: eyeScore,
        status: feedback.eye_score !== null ? statusFromScore(eyeScore) : 'unavailable',
        evaluationNote: feedback.eye_score !== null
          ? `Kontak mata terjaga selama ${formatDuration(focusDuration)}, dengan ${formatDuration(unfocusDuration)} momen tidak fokus.`
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
        evaluationNote: 'Artikulasi masih dinilai dari kualitas transcript karena confidence per kata belum tersedia.'
      },
      {
        id: 'wordWaste',
        title: 'Pemborosan Kata',
        score: wordWasteScore,
        status: statusFromScore(wordWasteScore),
        evaluationNote: repeatedWords.length > 0
          ? `Terdapat ${repeatedWords.length} kata berulang yang berpotensi membuat penyampaian kurang ringkas.`
          : 'Tidak ditemukan pemborosan kata yang menonjol pada transcript.'
      }
    ],
    details: {
      intonation: {
        chart: [],
        metrics: { averageVolume: feedback.avg_volume },
        aiTips: feedback.mr_owi_tips?.intonasi || []
      },
      eyeContact: {
        events: [],
        focusDuration,
        unfocusDuration,
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
        aiTips: feedback.mr_owi_tips?.kata_jeda || []
      },
      articulation: {
        unclearSegments: [],
        aiTips: feedback.mr_owi_tips?.artikulasi || []
      },
      wordWaste: {
        transcript,
        wastedPhrases: repeatedWords.map(word => ({
          text: word,
          reason: 'Kata ini terdeteksi berulang dan berpotensi membuat kalimat kurang efisien.'
        })),
        aiTips: feedback.mr_owi_tips?.pemborosan_kata || []
      }
    }
  };
}

export const getSessionFeedback = async (req, res) => {
    try {
        const { session_id } = req.params

        const session = await verifySessionOwnership(session_id, req.user.id)
        if (!session) return res.status(404).json({ error: 'Session not found or forbidden' })

        const { data, error } = await supabaseAdmin
            .from('feedbacks')
            .select('*')
            .eq('session_id', session_id)
            .maybeSingle()

        if (error) throw error

        if (!data) {
            return res.json({ feedback: null })
        }

        let feedback = { ...data }
        if (!feedback.evaluation_json) {
            const [
                { data: audioRecording },
                { data: repeatedWords },
                { data: sessionData }
            ] = await Promise.all([
                supabaseAdmin
                    .from('audio_recordings')
                    .select('transcript, word_timings')
                    .eq('session_id', session_id)
                    .maybeSingle(),
                supabaseAdmin
                    .from('feedback_repeated_words')
                    .select('word, count')
                    .eq('feedback_id', feedback.id),
                supabaseAdmin
                    .from('game_sessions')
                    .select('duration')
                    .eq('id', session_id)
                    .maybeSingle()
            ])

            feedback.evaluation_json = buildEvaluationJson(feedback, audioRecording, repeatedWords, sessionData)

            // Cache the generated evaluation_json back to the database
            const { error: updateError } = await supabaseAdmin
                .from('feedbacks')
                .update({ evaluation_json: feedback.evaluation_json })
                .eq('id', feedback.id)

            if (updateError) {
                console.error(`[getSessionFeedback] Failed to cache evaluation_json for feedback ${feedback.id}:`, updateError.message)
            }
        } else {
            const needsTempoRefresh = chartLooksLikeFallback(
                feedback.evaluation_json?.details?.tempo?.chart,
                feedback.evaluation_json?.details?.tempo?.segments
            )

            if (needsTempoRefresh) {
                const [
                    { data: audioRecording },
                    { data: sessionData }
                ] = await Promise.all([
                    supabaseAdmin
                        .from('audio_recordings')
                        .select('word_timings')
                        .eq('session_id', session_id)
                        .maybeSingle(),
                    supabaseAdmin
                        .from('game_sessions')
                        .select('duration')
                        .eq('id', session_id)
                        .maybeSingle()
                ])

                const refreshed = refreshTempoFromWordTimings(
                    feedback.evaluation_json,
                    audioRecording,
                    sessionData,
                    feedback.wpm
                )

                if (refreshed.changed) {
                    feedback.evaluation_json = refreshed.evaluation

                    const { error: updateError } = await supabaseAdmin
                        .from('feedbacks')
                        .update({ evaluation_json: feedback.evaluation_json })
                        .eq('id', feedback.id)

                    if (updateError) {
                        console.error(`[getSessionFeedback] Failed to refresh tempo chart for feedback ${feedback.id}:`, updateError.message)
                    }
                }
            }
        }

        res.json({ feedback })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// ACHIEVEMENTS
// ================================

export const getAchievements = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('achievements')
            .select('*')
            .eq('user_id', req.user.id)

        if (error) throw error
        res.json({ achievements: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

