import {
  getReminderMessage,
  getReminderSubject,
} from './reminderScheduler.js'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const DEFAULT_FROM_EMAIL = 'noreply@pressup.app'
const DEFAULT_FROM_NAME = 'Press Up'

function formatPresentationDate(dateValue, timeZone = 'Asia/Jakarta') {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(dateValue))
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildReminderHtml({ profile, schedule, reminder }) {
  const name = profile?.name || 'Sobat Press Up'
  const title = schedule?.presentation_title || 'Presentasi'
  const timeZone = schedule?.timezone || 'Asia/Jakarta'
  const subject = getReminderSubject(reminder.reminder_type)
  const message = getReminderMessage(reminder.reminder_type)
  const presentationDate = formatPresentationDate(
    schedule.presentation_date,
    timeZone,
  )

  return `
    <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:24px; border:1px solid #e2e8f0;">
        <p style="margin:0 0 8px; color:#0f172a; font-size:14px;">Halo ${escapeHtml(name)},</p>
        <h1 style="margin:0 0 12px; color:#0f172a; font-size:24px;">${escapeHtml(subject)}</h1>
        <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">${escapeHtml(message)}</p>
        <div style="background:#e0f2fe; border-radius:12px; padding:16px; margin:18px 0;">
          <p style="margin:0; color:#0369a1; font-size:13px; font-weight:700;">${escapeHtml(title)}</p>
          <p style="margin:6px 0 0; color:#0f172a; font-size:16px; font-weight:700;">${escapeHtml(presentationDate)}</p>
        </div>
        <p style="margin:0; color:#475569; font-size:14px; line-height:1.6;">Buka Press Up dan lakukan satu sesi latihan singkat agar penyampaianmu makin siap.</p>
      </div>
    </div>
  `
}

function buildReminderText({ profile, schedule, reminder }) {
  const name = profile?.name || 'Sobat Press Up'
  const title = schedule?.presentation_title || 'Presentasi'
  const timeZone = schedule?.timezone || 'Asia/Jakarta'

  return [
    `Halo ${name},`,
    getReminderSubject(reminder.reminder_type),
    getReminderMessage(reminder.reminder_type),
    `${title}: ${formatPresentationDate(schedule.presentation_date, timeZone)}`,
    'Buka Press Up dan lakukan satu sesi latihan singkat.',
  ].join('\n\n')
}

export async function sendScheduleReminderEmail({ profile, schedule, reminder }) {
  const apiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY
  const senderEmail = process.env.REMINDER_EMAIL_FROM || DEFAULT_FROM_EMAIL
  const senderName = process.env.REMINDER_EMAIL_FROM_NAME || DEFAULT_FROM_NAME
  const to = profile?.email

  if (!apiKey) {
    throw new Error('BREVO_API_KEY belum dikonfigurasi')
  }

  if (!to) {
    throw new Error('Email user tidak ditemukan')
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email: to, name: profile?.name || undefined }],
      subject: getReminderSubject(reminder.reminder_type),
      html: buildReminderHtml({ profile, schedule, reminder }),
      text: buildReminderText({ profile, schedule, reminder }),
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || 'Gagal mengirim email reminder')
  }

  return data
}
