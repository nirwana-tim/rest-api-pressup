import { Router } from 'express'
import multer from 'multer'
import { uploadVideo } from '../controllers/videos.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Konfigurasi multer menggunakan memory storage
const storage = multer.memoryStorage()
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // Limit 50MB (bisa disesuaikan)
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true)
        } else {
            cb(new Error('Hanya file video yang diperbolehkan!'), false)
        }
    }
})

// Endpoint upload
// Opsional: router.use(authenticate) jika ingin dilindungi dengan token
router.post('/upload', authenticate, upload.single('video'), uploadVideo)

export default router
