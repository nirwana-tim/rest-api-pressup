import { supabaseAdmin } from '../config/supabase.js'

const formatProfileResponse = (data) => ({
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    xp: data.xp || 0,
    level: data.level || 1
})

const createProfileIfNotExists = async (user) => {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

    if (data) return data
    if (error) throw error

    const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
            id: user.id,
            name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
            email: user.email,
            avatar: null
        })
        .select()
        .maybeSingle()

    if (insertError) throw insertError
    return newProfile
}

// ================================
// GET Profile
// ================================
export const getProfile = async (req, res) => {
    try {
        const profile = await createProfileIfNotExists(req.user)
        res.json({ profile: formatProfileResponse(profile) })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// UPDATE Profile
// ================================
export const updateProfile = async (req, res) => {
    try {
        const { name, avatar } = req.body
        const updates = {}
        if (name !== undefined) updates.name = name
        if (avatar !== undefined) {
            if (avatar !== null && ![1, 2].includes(avatar)) {
                return res.status(400).json({ error: 'Avatar harus bernilai 1, 2, atau null' })
            }
            updates.avatar = avatar
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Tidak ada data untuk diperbarui' })
        }

        let { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', req.user.id)
            .select()
            .maybeSingle()

        if (error) throw error

        if (!data) {
            const insertReq = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: req.user.id,
                    name: req.user.user_metadata?.full_name || req.user.user_metadata?.name || 'User',
                    email: req.user.email,
                    avatar: null,
                    ...updates
                })
                .select()
                .maybeSingle()

            if (insertReq.error) throw insertReq.error
            data = insertReq.data
        }

        if (updates.name !== undefined) {
            await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
                user_metadata: { name: updates.name }
            })
        }

        res.json({ message: 'Profil berhasil diperbarui', profile: formatProfileResponse(data) })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
