import { supabaseAdmin } from '../config/supabase.js'

// ================================
// GET Schedule — Ambil jadwal presentasi aktif
// ================================
export const getSchedule = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('schedules')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) throw error
        if (!data) return res.json({ schedule: null })

        res.json({ schedule: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// SAVE Schedule — Simpan/update jadwal presentasi
// ================================
export const saveSchedule = async (req, res) => {
    try {
        const { presentation_date } = req.body

        if (!presentation_date) {
            return res.status(400).json({ error: 'presentation_date wajib diisi' })
        }

        const parsedDate = new Date(presentation_date)
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: 'Format tanggal tidak valid' })
        }

        if (parsedDate <= new Date()) {
            return res.status(400).json({ error: 'Tanggal presentasi harus di masa depan' })
        }

        const existing = await supabaseAdmin
            .from('schedules')
            .select('id')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        let data, error

        if (existing.data) {
            // Update jadwal yang sudah ada
            const result = await supabaseAdmin
                .from('schedules')
                .update({ presentation_date: parsedDate.toISOString() })
                .eq('id', existing.data.id)
                .select()
                .maybeSingle()
            data = result.data
            error = result.error
        } else {
            // Insert jadwal baru
            const result = await supabaseAdmin
                .from('schedules')
                .insert({
                    user_id: req.user.id,
                    presentation_date: parsedDate.toISOString(),
                })
                .select()
                .maybeSingle()
            data = result.data
            error = result.error
        }

        if (error) throw error

        res.json({ message: 'Jadwal berhasil disimpan', schedule: data })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// DELETE Schedule — Hapus jadwal
// ================================
export const deleteSchedule = async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('schedules')
            .delete()
            .eq('user_id', req.user.id)

        if (error) throw error

        res.json({ message: 'Jadwal berhasil dihapus' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
