import { Router } from 'express'
import { register, login, getProfile, googleCallback, refreshToken, forgotPassword, updatePassword } from '../controllers/auth.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/google', googleCallback)      // Google OAuth callback
router.post('/refresh', refreshToken)       // Refresh token expired
router.post('/forgot-password', forgotPassword)
router.put('/update-password', authenticate, updatePassword)
router.get('/profile', authenticate, getProfile)

export default router
