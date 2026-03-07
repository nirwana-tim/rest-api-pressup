import { supabaseAdmin } from '../config/supabase.js'

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

        // Verify session belongs to user
        const { data: session } = await supabaseAdmin
            .from('game_sessions')
            .select('id')
            .eq('id', session_id)
            .eq('user_id', req.user.id)
            .maybeSingle()

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
