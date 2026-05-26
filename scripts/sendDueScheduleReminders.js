import dotenv from 'dotenv'

dotenv.config()

const port = process.env.PORT || 3000
const baseUrl = process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${port}`
const cronSecret = process.env.CRON_SECRET

if (!cronSecret) {
  console.error('CRON_SECRET belum dikonfigurasi')
  process.exit(1)
}

const response = await fetch(`${baseUrl}/api/schedule/reminders/send-due`, {
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
