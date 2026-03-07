import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import authRoutes from './src/routes/auth.js'
import postRoutes from './src/routes/posts.js'
import profileRoutes from './src/routes/profiles.js'
import gameRoutes from './src/routes/games.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Routes
app.get('/', (req, res) => res.json({ message: 'API is running 🚀' }))
app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/game', gameRoutes)

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan' }))

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`)
})