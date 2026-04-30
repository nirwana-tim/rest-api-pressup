import { Router } from 'express'
import {
    createSession,
    getSessions,
    updateSessionStatus,
    postRecording,
    postFeedback,
    getSessionFeedback,
    getAchievements,
    analyzeTranscript
} from '../controllers/games.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// Sessions
router.post('/sessions', createSession)
router.get('/sessions', getSessions)
router.put('/sessions/:id', updateSessionStatus)
router.post('/sessions/:session_id/analyze-transcript', analyzeTranscript)

// Recordings
router.post('/recordings', postRecording)

// Feedback
router.post('/feedback', postFeedback)
router.get('/sessions/:session_id/feedback', getSessionFeedback)

// Achievements
router.get('/achievements', getAchievements)

export default router
