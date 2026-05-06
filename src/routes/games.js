import { Router } from 'express'
import multer from 'multer'
import os from 'os'
import {
    createSession,
    getSessions,
    updateSessionStatus,
    postRecording,
    postFeedback,
    getSessionFeedback,
    getAchievements,
    analyzeTranscript,
    analyzeAudio
} from '../controllers/games.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Multer config: simpan file audio ke temp directory
const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
            cb(null, true)
        } else {
            cb(new Error('Only audio files are allowed'), false)
        }
    }
})

router.use(authenticate)

// Sessions
router.post('/sessions', createSession)
router.get('/sessions', getSessions)
router.put('/sessions/:id', updateSessionStatus)
router.post('/sessions/:session_id/analyze-transcript', analyzeTranscript)
router.post('/sessions/:session_id/analyze-audio', upload.single('audio'), analyzeAudio)

// Recordings
router.post('/recordings', postRecording)

// Feedback
router.post('/feedback', postFeedback)
router.get('/sessions/:session_id/feedback', getSessionFeedback)

// Achievements
router.get('/achievements', getAchievements)

export default router
