if (process.env.npm_lifecycle_event === 'start') {
  process.env.NODE_ENV = 'production';
}

if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
}

import express from 'express'
import cors from 'cors'
import fs from 'fs'
import helmet from 'helmet'
import dotenv from 'dotenv'
import authRoutes from './src/routes/auth.js'
import profileRoutes from './src/routes/profiles.js'
import gameRoutes from './src/routes/games.js'
import scheduleRoutes from './src/routes/schedules.js'
import videoRoutes from './src/routes/videos.js'
import audioRoutes from './src/routes/audio.js'

import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Override console.error untuk mencatat kesalahan fatal ke log.txt
const originalConsoleError = console.error
console.error = (...args) => {
  originalConsoleError(...args)
  try {
    const timestamp = new Date().toISOString()
    const message = args
      .map(arg => {
        if (arg instanceof Error) {
          return `${arg.message}\n${arg.stack}`
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      })
      .join(' ')

    fs.appendFileSync(path.join(__dirname, 'log.txt'), `[${timestamp}] ERROR: ${message}\n\n`)
  } catch (err) {
    originalConsoleError('Gagal menulis error ke log.txt:', err.message)
  }
}

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.get('/', (req, res) => res.json({ message: 'API is running 🚀' }))
app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'))
})
app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/game', gameRoutes)
app.use('/api/analyze-audio', audioRoutes)
app.use('/api/schedule', scheduleRoutes)
app.use('/api/videos', videoRoutes)

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan' }))

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled Error: ${err.message}`, err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan server internal' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`)
})
