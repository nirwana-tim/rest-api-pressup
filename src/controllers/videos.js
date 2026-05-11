import { supabaseAdmin } from '../config/supabase.js'
import fs from 'fs'

export const uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file video yang diunggah' })
        }

        const file = req.file
        const fileExt = file.originalname.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `temp_videos/${fileName}`

        // Baca file dari disk
        const fileBuffer = fs.readFileSync(file.path)

        const { data, error } = await supabaseAdmin.storage
            .from('videos') // Pastikan bucket 'videos' sudah ada di Supabase
            .upload(filePath, fileBuffer, {
                contentType: file.mimetype,
                upsert: false
            })

        // Hapus file temporary setelah upload
        try { fs.unlinkSync(file.path); } catch {}

        if (error) throw error

        const { data: publicUrlData } = supabaseAdmin.storage
            .from('videos')
            .getPublicUrl(filePath)

        res.status(201).json({
            message: 'Video berhasil diunggah sementara',
            video_url: publicUrlData.publicUrl,
            path: filePath
        })
    } catch (err) {
        // Hapus file temporary jika error
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ error: err.message })
    }
}
