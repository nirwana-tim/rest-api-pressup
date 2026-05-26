import { supabaseAdmin } from '../config/supabase.js'
import { sendScheduleReminderEmail } from '../services/emailService.js'
import {
    buildScheduleReminders,
    isValidTimeZone,
} from '../services/reminderScheduler.js'

const DEFAULT_TIMEZONE = 'Asia/Jakarta'
const REMINDER_CRON_LIMIT = 25

async function regenerateScheduleReminders(schedule) {
    const now = new Date().toISOString()

    const { error: cancelError } = await supabaseAdmin
        .from('schedule_reminders')
        .update({ status: 'cancelled', updated_at: now })
        .eq('schedule_id', schedule.id)
        .eq('status', 'pending')

    if (cancelError) throw cancelError

    if (schedule.reminder_email_enabled === false) return []

    const reminders = buildScheduleReminders({
        scheduleId: schedule.id,
        userId: schedule.user_id,
        presentationDate: schedule.presentation_date,
        timezone: schedule.timezone || DEFAULT_TIMEZONE,
    })

    if (reminders.length === 0) return []

    const { data, error } = await supabaseAdmin
        .from('schedule_reminders')
        .insert(reminders)
        .select()

    if (error) throw error

    return data || []
}

async function getReminderContext(reminder) {
    const [{ data: schedule, error: scheduleError }, { data: profile, error: profileError }] =
        await Promise.all([
            supabaseAdmin
                .from('schedules')
                .select('*')
                .eq('id', reminder.schedule_id)
                .maybeSingle(),
            supabaseAdmin
                .from('profiles')
                .select('id, name, email')
                .eq('id', reminder.user_id)
                .maybeSingle(),
        ])

    if (scheduleError) throw scheduleError
    if (profileError) throw profileError

    return { schedule, profile }
}

// ================================
// GET Schedule — Ambil jadwal presentasi aktif
// ================================
export const getSchedule = async (req, res) => {
    try {
        console.log(`[GET_SCHEDULE] User: ${req.user?.id}`)

        if (!req.user?.id) {
            console.error('[GET_SCHEDULE] User ID missing in request')
            return res.status(401).json({ error: 'User tidak teridentifikasi' })
        }

        const { data, error } = await supabaseAdmin
            .from('schedules')
            .select('*')
            .eq('user_id', req.user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('[GET_SCHEDULE] Supabase error:', error.message)
            throw error
        }
        
        console.log('[GET_SCHEDULE] Data found:', data ? 'Yes' : 'No')
        if (!data) return res.json({ schedule: null })

        res.json({ schedule: data })
    } catch (err) {
        console.error('[GET_SCHEDULE] Crash:', err.message)
        res.status(500).json({ error: err.message })
    }
}

// ================================
// SAVE Schedule — Simpan/update jadwal presentasi
// ================================
export const saveSchedule = async (req, res) => {
    try {
        const {
            presentation_date,
            notification_id,
            presentation_title,
            timezone = DEFAULT_TIMEZONE,
            reminder_email_enabled,
        } = req.body

        if (!presentation_date) {
            return res.status(400).json({ error: 'presentation_date wajib diisi' })
        }

        if (!isValidTimeZone(timezone)) {
            return res.status(400).json({ error: 'timezone tidak valid' })
        }

        if (
            reminder_email_enabled !== undefined &&
            typeof reminder_email_enabled !== 'boolean'
        ) {
            return res.status(400).json({ error: 'reminder_email_enabled harus boolean' })
        }

        const parsedDate = new Date(presentation_date)
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: 'Format tanggal tidak valid' })
        }

        if (parsedDate <= new Date()) {
            return res.status(400).json({ error: 'Tanggal presentasi harus di masa depan' })
        }

        const existing = await supabaseAdmin
            .from('schedules')
            .select('id')
            .eq('user_id', req.user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        let data, error

        const payload = {
            presentation_date: parsedDate.toISOString(),
            timezone,
            ...(notification_id && { notification_id }),
            ...(presentation_title !== undefined && { presentation_title }),
            ...(reminder_email_enabled !== undefined && { reminder_email_enabled }),
        }

        if (existing.data) {
            // Update jadwal yang sudah ada
            const result = await supabaseAdmin
                .from('schedules')
                .update(payload)
                .eq('id', existing.data.id)
                .select()
                .maybeSingle()
            data = result.data
            error = result.error
        } else {
            // Insert jadwal baru
            const result = await supabaseAdmin
                .from('schedules')
                .insert({
                    user_id: req.user.id,
                    ...payload
                })
                .select()
                .maybeSingle()
            data = result.data
            error = result.error
        }

        if (error) throw error

        const reminders = await regenerateScheduleReminders(data)

        res.json({
            message: 'Jadwal berhasil disimpan',
            schedule: data,
            reminders,
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// DELETE Schedule — Hapus jadwal
// ================================
export const deleteSchedule = async (req, res) => {
    try {
        const { data: schedules, error: findError } = await supabaseAdmin
            .from('schedules')
            .select('id')
            .eq('user_id', req.user.id)
            .is('deleted_at', null)

        if (findError) throw findError

        const scheduleIds = (schedules || []).map((schedule) => schedule.id)

        if (scheduleIds.length > 0) {
            const { error: cancelError } = await supabaseAdmin
                .from('schedule_reminders')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .in('schedule_id', scheduleIds)
                .eq('status', 'pending')

            if (cancelError) throw cancelError
        }

        const { error } = await supabaseAdmin
            .from('schedules')
            .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', req.user.id)
            .is('deleted_at', null)

        if (error) throw error

        res.json({ message: 'Jadwal berhasil dihapus' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// ================================
// SEND Due Reminders — Dipanggil cron job backend
// ================================
export const sendDueScheduleReminders = async (req, res) => {
    try {
        const cronSecret = process.env.CRON_SECRET
        const requestSecret = req.headers['x-cron-secret'] || req.query.secret

        if (!cronSecret || requestSecret !== cronSecret) {
            return res.status(401).json({ error: 'Unauthorized cron request' })
        }

        const { data: reminders, error } = await supabaseAdmin
            .from('schedule_reminders')
            .select('*')
            .eq('status', 'pending')
            .lte('reminder_at', new Date().toISOString())
            .order('reminder_at', { ascending: true })
            .limit(REMINDER_CRON_LIMIT)

        if (error) throw error

        const results = []

        for (const reminder of reminders || []) {
            const { data: lockedReminder, error: lockError } = await supabaseAdmin
                .from('schedule_reminders')
                .update({ status: 'processing', updated_at: new Date().toISOString() })
                .eq('id', reminder.id)
                .eq('status', 'pending')
                .select()
                .maybeSingle()

            if (lockError) {
                results.push({ id: reminder.id, status: 'failed', error: lockError.message })
                continue
            }

            if (!lockedReminder) continue

            try {
                const { schedule, profile } = await getReminderContext(lockedReminder)

                if (
                    !schedule ||
                    schedule.deleted_at ||
                    schedule.reminder_email_enabled === false ||
                    new Date(schedule.presentation_date) <= new Date()
                ) {
                    await supabaseAdmin
                        .from('schedule_reminders')
                        .update({
                            status: 'cancelled',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', lockedReminder.id)

                    results.push({ id: lockedReminder.id, status: 'cancelled' })
                    continue
                }

                await sendScheduleReminderEmail({
                    profile,
                    schedule,
                    reminder: lockedReminder,
                })

                await supabaseAdmin
                    .from('schedule_reminders')
                    .update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        error_message: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', lockedReminder.id)

                results.push({ id: lockedReminder.id, status: 'sent' })
            } catch (sendError) {
                await supabaseAdmin
                    .from('schedule_reminders')
                    .update({
                        status: 'failed',
                        error_message: sendError.message,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', lockedReminder.id)

                results.push({
                    id: lockedReminder.id,
                    status: 'failed',
                    error: sendError.message,
                })
            }
        }

        res.json({
            message: 'Reminder cron selesai',
            processed: results.length,
            results,
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
