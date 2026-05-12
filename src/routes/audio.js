import { Router } from 'express'
import { analyzeAudioFromStorage } from '../controllers/audio.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/', authenticate, analyzeAudioFromStorage)

export default router
