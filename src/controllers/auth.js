import { supabase, supabaseAdmin } from '../config/supabase.js'

// ================================
// REGISTER dengan email & password
// ================================
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' })
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    })

    if (error) return res.status(400).json({ error: error.message })

    // Create profile Record
    if (data.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: data.user.id,
          name: name || 'User',
          email: data.user.email
        })
      if (profileError) console.error('Error creating profile:', profileError.message)
    }

    res.status(201).json({
      message: 'Registrasi berhasil! Cek email untuk verifikasi.',
      token: data.session?.access_token || null,
      refresh_token: data.session?.refresh_token || null,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || null
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// LOGIN dengan email & password
// ================================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' })
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) return res.status(401).json({ error: 'Email atau password salah' })

    res.json({
      message: 'Login berhasil',
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || null,
        provider: data.user.app_metadata?.provider || 'email'
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// GOOGLE LOGIN - verifikasi token dari Expo
// ================================
export const googleCallback = async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body

    if (!access_token) {
      return res.status(400).json({ error: 'access_token wajib diisi' })
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token)

    if (error || !user) {
      return res.status(401).json({ error: 'Token Google tidak valid' })
    }

    res.json({
      message: 'Login Google berhasil',
      token: access_token,
      refresh_token: refresh_token || null,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar: user.user_metadata?.avatar_url || null,
        provider: 'google'
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// REFRESH TOKEN
// ================================
export const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token wajib diisi' })
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token })

    if (error) return res.status(401).json({ error: 'Refresh token tidak valid atau expired' })

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// GET PROFILE
// ================================
export const getProfile = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.user_metadata?.full_name || req.user.user_metadata?.name || null,
        avatar: req.user.user_metadata?.avatar_url || null,
        provider: req.user.app_metadata?.provider || 'email'
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
