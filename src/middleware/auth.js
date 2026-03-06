import { supabaseAdmin } from '../config/supabase.js'

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ada atau format salah' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Token tidak valid atau expired' })
    }

    req.user = user
    next()

  } catch (err) {
    return res.status(500).json({ error: 'Server error' })
  }
}