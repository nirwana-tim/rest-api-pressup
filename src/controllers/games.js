import { supabaseAdmin } from '../config/supabase.js'
import OpenAI from 'openai'

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
        const { topic, duration } = req.body
        if (!topic || !duration) return res.status(400).json({ error: 'Topic dan duration wajib diisi' })

        const { data, error } = await supabaseAdmin
            .from('game_sessions')
            .insert({ user_id: req.user.id, topic, duration, status: 'recording' })
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
        const { session_id, audio_url, video_url, transcript } = req.body

        if (audio_url && (audio_url.startsWith('data:image') || audio_url.startsWith('/'))) {
            return res.status(400).json({ error: 'Cannot read image (this model does not support image input).' })
        }
        if (video_url && (video_url.startsWith('data:image') || video_url.startsWith('/'))) {
            return res.status(400).json({ error: 'Cannot read image (this model does not support image input).' })
        }

        const session = await verifySessionOwnership(session_id, req.user.id)
        if (!session) return res.status(404).json({ error: 'Session not found or forbidden' })

        const { data, error } = await supabaseAdmin
            .from('recordings')
            .insert({ session_id, audio_url, video_url, transcript })
            .select()
            .single()

        if (error) throw error
        res.status(201).json({ message: 'Recording saved', recording: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// FEEDBACKS
// ================================

export const postFeedback = async (req, res) => {
    try {
        const { session_id, eye_score, voice_score, filler_score, content_score, confidence_score, summary, improvement_tips } = req.body

        const session = await verifySessionOwnership(session_id, req.user.id)
        if (!session) return res.status(404).json({ error: 'Session not found or forbidden' })

        const { data, error } = await supabaseAdmin
            .from('feedbacks')
            .insert({ session_id, eye_score, voice_score, filler_score, content_score, confidence_score, summary, improvement_tips })
            .select()
            .single()

        if (error) throw error
        res.status(201).json({ message: 'Feedback saved', feedback: data })
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
            .from('recordings')
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
