import dotenv from 'dotenv'

dotenv.config()

const baseUrl = process.env.INTERNAL_API_BASE_URL
const cronSecret = process.env.CRON_SECRET

if (!baseUrl) {
  console.error('INTERNAL_API_BASE_URL belum dikonfigurasi')
  process.exit(1)
}

if (!cronSecret) {
  console.error('CRON_SECRET belum dikonfigurasi')
  process.exit(1)
}

try {
  new URL(baseUrl)
} catch {
  console.error('INTERNAL_API_BASE_URL tidak valid')
  process.exit(1)
}

const reminderEndpoint = new URL('/api/schedule/reminders/send-due', baseUrl)

const response = await fetch(reminderEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-cron-secret': cronSecret,
  },
})

const data = await response.json().catch(() => ({}))

if (!response.ok) {
  console.error('Gagal menjalankan reminder cron:', data)
  process.exit(1)
}

console.log(JSON.stringify(data))
