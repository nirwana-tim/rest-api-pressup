import { supabaseAdmin } from '../config/supabase.js'
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

