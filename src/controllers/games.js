import { supabaseAdmin } from '../config/supabase.js'
import OpenAI from 'openai'
import fs from 'fs'

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
            wpm: wpm ?? 0,
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
        res.json({ feedback: data })
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

// ================================
// TRANSCRIPT ANALYSIS
// ================================

export const analyzeTranscript = async (req, res) => {
    try {
        const { session_id } = req.params;
        const { transcript } = req.body;

        if (!transcript) {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        const session = await verifySessionOwnership(session_id, req.user.id);
        if (!session) return res.status(404).json({ error: 'Session not found or forbidden' });

        // 1. Initialize OpenAI client for Groq
        const openai = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });

        // 2. Ask AI to analyze
        const prompt = `Anda adalah ahli tata bahasa. Analisis transkrip berikut. Berikan output dalam format JSON dengan struktur:
{
  "errors": [
    {
      "original_text": "Kata/kalimat yang salah",
      "corrected_text": "Saran perbaikan dari AI",
      "error_type": "grammar/pronunciation/filler_word/etc",
      "explanation": "Alasan kenapa itu salah"
    }
  ],
  "overall_score": 85,
  "summary": "Ringkasan analisis transkrip."
}
Berikan hanya format JSON tanpa teks tambahan.
`;
        
        const aiResponse = await openai.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: transcript }
            ],
            response_format: { type: "json_object" }
        });

        const analysisText = aiResponse.choices[0].message.content;
        let analysis;
        try {
            analysis = JSON.parse(analysisText);
        } catch (e) {
            console.error('Failed to parse AI response:', analysisText);
            return res.status(500).json({ error: 'AI failed to return valid JSON format' });
        }

        // 3. Get recording_id for the session
        const { data: recording, error: recordingError } = await supabaseAdmin
            .from('audio_recordings')
            .select('id')
            .eq('session_id', session_id)
            .maybeSingle();

        if (recordingError) throw recordingError;
        if (!recording) return res.status(404).json({ error: 'Recording not found for this session' });

        // 4. Save analysis to transcript_analyses
        if (analysis.errors && analysis.errors.length > 0) {
            const insertData = analysis.errors.map(err => ({
                recording_id: recording.id,
                ...err
            }));
            const { error: insertError } = await supabaseAdmin.from('transcript_analyses').insert(insertData);
            if (insertError) throw insertError;
        }

        // 5. Update feedback score
        const { error: feedbackError } = await supabaseAdmin
            .from('feedbacks')
            .update({ 
                transcript_score: analysis.overall_score || 0,
                summary: analysis.summary 
            })
            .eq('session_id', session_id);
        
        if (feedbackError) throw feedbackError;

        return res.status(200).json({ message: "Analysis completed", data: analysis });
    } catch (err) {
        console.error('Analysis Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ================================
// AUDIO ANALYSIS (Upload + Whisper STT + Filler Analysis)
// ================================

// Daftar filler words Bahasa Indonesia
const FILLER_WORDS_ID = [
    'eee', 'emm', 'anu', 'jadi', 'kayak', 'kayaknya', 'gitu', 'gitulah',
    'kan', 'tuh', 'nah', 'ya', 'yaa', 'hmm', 'apa', 'apaya', 'pokoknya',
    'sebenarnya', 'sebenernya', 'basically', 'like', 'you know',
    'ehm', 'eeh', 'umm', 'eem', 'hmmmm', 'hm', 'eh'
];

export const analyzeAudio = async (req, res) => {
    try {
        const { session_id } = req.params;
        const durationSeconds = parseInt(req.body.duration_seconds) || 0;

        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        const session = await verifySessionOwnership(session_id, req.user.id);
        if (!session) return res.status(404).json({ error: 'Session not found or forbidden' });

        // 1. Initialize OpenAI client for Groq
        const openai = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });

        // 2. Transcribe audio menggunakan Groq Whisper
        let transcript = '';
        try {
            const audioFile = fs.createReadStream(req.file.path);
            const transcription = await openai.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-large-v3",
                language: "id",
                response_format: "text",
            });
            transcript = transcription || '';
        } catch (whisperErr) {
            console.error('Whisper transcription failed:', whisperErr);
            // Cleanup temp file
            if (req.file.path) fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: 'Transcription failed: ' + whisperErr.message });
        }

        // Cleanup temp file setelah transcription
        if (req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }

        // 3. Analisis filler words dan kata berulang
        const words = transcript.toLowerCase()
            .replace(/[.,!?;:"""''()[\]{}]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 0);

        const totalWords = words.length;

        // Hitung filler words
        const fillerFound = [];
        const fillerCounts = {};
        words.forEach(word => {
            if (FILLER_WORDS_ID.includes(word)) {
                fillerCounts[word] = (fillerCounts[word] || 0) + 1;
                if (!fillerFound.includes(word)) fillerFound.push(word);
            }
        });
        const fillerCount = Object.values(fillerCounts).reduce((a, b) => a + b, 0);

        // Hitung kata berulang (muncul > 3 kali, exclude filler & common words)
        const commonWords = ['yang', 'dan', 'di', 'ini', 'itu', 'untuk', 'dengan', 'dari',
            'ke', 'saya', 'kita', 'akan', 'bisa', 'ada', 'tidak', 'juga', 'sudah',
            'pada', 'oleh', 'dalam', 'sebagai', 'atau', 'karena', 'mereka', 'kami',
            'kalian', 'lalu', 'maka', 'tapi', 'tetapi', 'namun', 'serta'];
        const wordFrequency = {};
        words.forEach(word => {
            if (!FILLER_WORDS_ID.includes(word) && !commonWords.includes(word) && word.length > 2) {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }
        });
        const repeatedWords = Object.entries(wordFrequency)
            .filter(([, count]) => count > 3)
            .map(([word]) => word);

        // 4. Gunakan Groq untuk analisis lebih dalam (opsional, jika transcript cukup panjang)
        let aiSummary = '';
        let overallScore = 0;

        if (totalWords > 10) {
            try {
                const analysisPrompt = `Anda adalah ahli analisis presentasi. Analisis transkrip berikut dan berikan output JSON:
{
  "overall_score": <skor 0-100 berdasarkan kualitas konten>,
  "summary": "<ringkasan singkat + saran perbaikan dalam 2-3 kalimat bahasa Indonesia>"
}
Berikan hanya JSON tanpa teks tambahan.`;

                const aiResponse = await openai.chat.completions.create({
                    model: "meta-llama/llama-4-scout-17b-16e-instruct",
                    messages: [
                        { role: "system", content: analysisPrompt },
                        { role: "user", content: transcript }
                    ],
                    response_format: { type: "json_object" }
                });

                const parsed = JSON.parse(aiResponse.choices[0].message.content);
                overallScore = parsed.overall_score || 0;
                aiSummary = parsed.summary || '';
            } catch (aiErr) {
                console.error('AI analysis failed:', aiErr);
                // Non-fatal: return data tanpa AI summary
            }
        }

        // 5. Save recording ke database
        try {
            await supabaseAdmin
                .from('audio_recordings')
                .insert({
                    session_id,
                    transcript,
                    is_processed: true,
                    processing_status: 'completed',
                    processed_at: new Date()
                });
        } catch {}

        // 6. Return hasil lengkap
        return res.status(200).json({
            message: "Audio analysis completed",
            data: {
                transcript,
                filler_words: fillerFound,
                filler_count: fillerCount,
                repeated_words: repeatedWords,
                total_words: totalWords,
                overall_score: overallScore,
                summary: aiSummary,
            }
        });
    } catch (err) {
        console.error('Audio Analysis Error:', err);
        // Cleanup temp file jika error
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ error: err.message });
    }
};
