import { z } from 'zod'
import { supabaseAdmin } from '../config/supabase.js'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const MAX_AUDIO_DURATION_SECONDS = Number(process.env.MAX_AUDIO_DURATION_SECONDS ?? 900)
const SUPABASE_AUDIO_BUCKET = process.env.SUPABASE_AUDIO_BUCKET ?? 'session-audios'
const AUDIO_FETCH_TIMEOUT_MS = 30_000

const analyzeAudioSchema = z.object({
  sessionId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  audio_url: z.string().url(),
  duration: z.number().int().positive().max(MAX_AUDIO_DURATION_SECONDS),
})

function getSupabaseHostname() {
  const supabaseUrl = process.env.SUPABASE_URL

  if (!supabaseUrl) {
    return undefined
  }

  try {
    return new URL(supabaseUrl).hostname
  } catch {
    return supabaseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
}

function validateSupabaseAudioUrl(audioUrl) {
  const url = new URL(audioUrl)
  const supabaseHostname = getSupabaseHostname()

  if (url.protocol !== 'https:') {
    throw new Error('Audio URL must use HTTPS')
  }

  if (supabaseHostname && url.hostname !== supabaseHostname) {
    throw new Error('Audio URL host is not allowed')
  }

  if (!url.pathname.includes('/storage/v1/object/')) {
    throw new Error('Audio URL is not a Supabase Storage object URL')
  }

  if (!url.pathname.includes(`/${SUPABASE_AUDIO_BUCKET}/`)) {
    throw new Error('Audio URL bucket is not allowed')
  }

  return url
}

async function verifySessionOwnership(sessionId, userId) {
  const { data, error } = await supabaseAdmin
    .from('game_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

function validateAudioResponse(response) {
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: HTTP ${response.status}`)
  }

  const contentLength = response.headers.get('content-length')

  if (contentLength && Number(contentLength) > MAX_AUDIO_BYTES) {
    throw new Error('Audio file exceeds 25 MB limit')
  }

  const contentType = response.headers.get('content-type') ?? ''
  const allowedTypes = [
    'audio/m4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'application/octet-stream',
  ]

  if (!allowedTypes.some((type) => contentType.includes(type))) {
    throw new Error(`Unsupported audio content type: ${contentType}`)
  }
}

async function validateRemoteAudio(audioUrl) {
  validateSupabaseAudioUrl(audioUrl)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(audioUrl, {
      method: 'HEAD',
      signal: controller.signal,
    })

    validateAudioResponse(response)
  } finally {
    clearTimeout(timeout)
  }
}

async function saveInitialRecording({ sessionId, audioUrl, duration }) {
  const { data, error } = await supabaseAdmin.from('audio_recordings').insert({
    session_id: sessionId,
    audio_url: audioUrl,
    is_processed: false,
    processing_status: 'processing',
  }).select().maybeSingle()

  if (error) {
    console.warn('[analyze-audio] failed to save initial recording:', error.message)
    throw error
  }
  
  return data
}

async function triggerAsyncProcessing(sessionId, audioUrl, duration) {
  try {
    const url = `${process.env.PROCESSOR_API_URL}/api/process-audio`
    console.log(`[analyze-audio] Triggering async processing at ${url}`)
    fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-secret': process.env.API_SECRET_KEY
      },
      body: JSON.stringify({ sessionId, audio_url: audioUrl, duration }),
    }).catch(err => {
      console.error('[analyze-audio] Background fetch to API 2 failed:', err.message)
    })
  } catch (err) {
    console.error('[analyze-audio] Failed to initiate async trigger:', err.message)
  }
}

export const analyzeAudioFromStorage = async (req, res) => {
  try {
    const parsed = analyzeAudioSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const input = parsed.data
    const session = await verifySessionOwnership(input.sessionId, req.user.id)

    if (!session) {
      return res.status(404).json({
        message: 'Session not found or forbidden',
        code: 'SESSION_NOT_FOUND',
      })
    }

    await validateRemoteAudio(input.audio_url)
    
    // Update game_sessions status to 'processing'
    const { error: sessionError } = await supabaseAdmin
      .from('game_sessions')
      .update({ status: 'processing' })
      .eq('id', input.sessionId)
      .eq('user_id', req.user.id)

    if (sessionError) {
      console.warn('[analyze-audio] failed to update game session status:', sessionError.message)
      throw sessionError
    }
    
    // Save initial state to Supabase DB (Processing)
    const recording = await saveInitialRecording({
      sessionId: input.sessionId,
      audioUrl: input.audio_url,
      duration: input.duration,
    })

    // Trigger async background processing in API 2
    triggerAsyncProcessing(input.sessionId, input.audio_url, input.duration)

    return res.status(202).json({
      message: 'Audio received and is being processed asynchronously',
      data: {
        sessionId: input.sessionId,
        status: 'processing'
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'

    console.error('[analyze-audio] failed:', message)

    if (message.includes('Audio URL')) {
      return res.status(400).json({ message, code: 'INVALID_AUDIO_URL' })
    }

    if (message.includes('25 MB') || message.includes('Unsupported audio')) {
      return res.status(413).json({
        message,
        code: 'AUDIO_TOO_LARGE_OR_UNSUPPORTED',
      })
    }

    if (message.includes('Failed to fetch audio')) {
      return res.status(422).json({ message, code: 'AUDIO_FETCH_FAILED' })
    }

    return res.status(500).json({
      message: 'Failed to analyze audio',
      code: 'AUDIO_ANALYSIS_FAILED',
    })
  }
}
