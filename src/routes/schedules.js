import { Router } from 'express'
import {
  deleteSchedule,
  getSchedule,
  saveSchedule,
  sendDueScheduleReminders,
} from '../controllers/schedules.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/reminders/send-due', sendDueScheduleReminders)

router.use(authenticate)

router.get('/', getSchedule)
router.post('/', saveSchedule)
router.delete('/', deleteSchedule)

export default router
