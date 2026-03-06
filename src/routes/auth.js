import { Router } from 'express'
import { register, login, getProfile, googleCallback, refreshToken } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/google', googleCallback)      // Google OAuth callback
router.post('/refresh', refreshToken)       // Refresh token expired
router.get('/profile', authenticate, getProfile)

export default router
