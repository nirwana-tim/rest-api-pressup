import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import authRoutes from './src/routes/auth.js'
import profileRoutes from './src/routes/profiles.js'
import gameRoutes from './src/routes/games.js'

import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Routes
app.get('/', (req, res) => res.json({ message: 'API is running 🚀' }))
app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'))
})
app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/game', gameRoutes)

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan' }))

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`)
})