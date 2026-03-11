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
// ================================
// FORGOT PASSWORD
// ================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email wajib diisi' })
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) return res.status(400).json({ error: error.message })

    res.json({ message: 'Kode OTP telah dikirim ke email kamu.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// VERIFY OTP (Recovery)
// ================================
export const verifyOtp = async (req, res) => {
  try {
    const { email, token } = req.body

    if (!email || !token) {
      return res.status(400).json({ error: 'Email dan kode OTP wajib diisi' })
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery'
    })

    if (error) return res.status(400).json({ error: 'Kode OTP salah atau expired' })

    res.json({
      message: 'OTP valid. Silakan perbarui password Anda.',
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// UPDATE PASSWORD (authenticated)
// ================================
export const updatePassword = async (req, res) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ error: 'Password baru wajib diisi' })
    }

    // Gunakan admin client untuk update user berdasarkan ID dari middleware authenticate
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      { password }
    )

    if (error) return res.status(400).json({ error: error.message })

    res.json({ message: 'Password berhasil diperbarui', user: data.user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
