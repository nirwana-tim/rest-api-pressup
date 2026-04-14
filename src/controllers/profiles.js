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
        
        if (!data) {
            // Jika profil tidak ditemukan, buat otomatis
            const insertReq = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: req.user.id,
                    name: req.user.user_metadata?.full_name || req.user.user_metadata?.name || 'User',
                    email: req.user.email,
                    avatar: null
                })
                .select()
                .maybeSingle()

            if (insertReq.error) throw insertReq.error
            data = insertReq.data
        }

        res.json({ profile: { id: data.id, name: data.name, avatar: data.avatar, xp: data.xp || 0, level: data.level || 1 } })
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

        let { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', req.user.id)
            .select()
            .maybeSingle()

        // Juga melakukan sinkronisasi dengan metadata Auth (agar nama di register ikut terupdate)
        if (updates.name !== undefined) {
             await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
                 user_metadata: { name: updates.name }
             })
        }

        if (error) throw error
        
        if (!data) {
            // Jika profil tidak ditemukan saat diupdate, buat profil baru dengan kombinasi updates
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

        res.json({ message: 'Profil berhasil diperbarui', profile: { ...data, xp: data.xp || 0, level: data.level || 1 } })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
