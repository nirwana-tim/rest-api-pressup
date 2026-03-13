import { Router } from 'express'
import { getSchedule, saveSchedule, deleteSchedule } from '../controllers/schedules.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', getSchedule)
router.post('/', saveSchedule)
router.delete('/', deleteSchedule)

export default router
