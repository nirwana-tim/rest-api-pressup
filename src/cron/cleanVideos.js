import cron from 'node-cron'
import { supabaseAdmin } from '../config/supabase.js'

// Fungsi untuk menghapus video yang lebih lama dari 2 hari
export const cleanOldVideos = async () => {
    try {
        console.log('Menjalankan cron job: Mengecek video lama di Supabase storage...')

        // Ambil list file di dalam bucket 'videos' dan folder 'temp_videos'
        const { data: files, error: listError } = await supabaseAdmin.storage
            .from('videos')
            .list('temp_videos', {
                limit: 1000,
                offset: 0,
                sortBy: { column: 'created_at', order: 'asc' },
            })

        if (listError) throw listError
        if (!files || files.length === 0) {
            console.log('Tidak ada file video di dalam folder temp_videos.')
            return
        }

        const now = new Date()
        const filesToDelete = []

        files.forEach(file => {
            // Abaikan folder placeholder seperti .emptyFolderPlaceholder
            if (file.name === '.emptyFolderPlaceholder') return

            const fileCreatedAt = new Date(file.created_at)
            const diffInTime = now.getTime() - fileCreatedAt.getTime()
            const diffInDays = diffInTime / (1000 * 3600 * 24)

            // Jika usia file lebih dari 2 hari, masukkan ke daftar hapus
            if (diffInDays >= 2) {
                filesToDelete.push(`temp_videos/${file.name}`)
            }
        })

        if (filesToDelete.length > 0) {
            const { error: deleteError } = await supabaseAdmin.storage
                .from('videos')
                .remove(filesToDelete)

            if (deleteError) throw deleteError
            console.log(`Berhasil menghapus ${filesToDelete.length} video lama.`)
        } else {
            console.log('Tidak ada video yang usianya lebih dari 2 hari.')
        }
    } catch (error) {
        console.error('Error saat membersihkan video lama:', error.message)
    }
}

// Jadwalkan cron job untuk berjalan setiap hari pada tengah malam (00:00)
// Format cron: menit jam tanggal bulan hari
export const startVideoCleanupCron = () => {
    cron.schedule('0 0 * * *', cleanOldVideos, {
        scheduled: true,
        timezone: 'Asia/Jakarta'
    })
    console.log('Cron job cleanup video berhasil dijadwalkan.')
}
