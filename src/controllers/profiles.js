import { supabaseAdmin } from '../config/supabase.js'

// ================================
// GET Profile
// ================================
export const getProfile = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .maybeSingle()

        if (error) throw error
        if (!data) return res.status(404).json({ error: 'Profil tidak ditemukan' })

        res.json({ profile: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// UPDATE Profile
// ================================
export const updateProfile = async (req, res) => {
    try {
        const { name, xp, level } = req.body
        const updates = {}
        if (name !== undefined) updates.name = name
        if (xp !== undefined) updates.xp = xp
        if (level !== undefined) updates.level = level

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', req.user.id)
            .select()
            .maybeSingle()

        if (error) throw error
        if (!data) return res.status(404).json({ error: 'Profil tidak ditemukan' })

        res.json({ message: 'Profil berhasil diperbarui', profile: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
