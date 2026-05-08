import { supabaseAdmin } from '../config/supabase.js'

export const uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file video yang diunggah' })
        }

        const file = req.file
        const fileExt = file.originalname.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `temp_videos/${fileName}`

        const { data, error } = await supabaseAdmin.storage
            .from('videos') // Pastikan bucket 'videos' sudah ada di Supabase
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            })

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
        res.status(500).json({ error: err.message })
    }
}
