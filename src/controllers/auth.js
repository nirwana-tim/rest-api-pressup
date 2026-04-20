import { supabase, supabaseAdmin } from "../config/supabase.js";
import { createProfileIfNotExists } from "./profiles.js";

// ================================
// REGISTER dengan email & password
// ================================
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) return res.status(400).json({ error: error.message });

    // Pastikan profil di tabel profiles juga dibuat
    const profile = await createProfileIfNotExists(data.user);

    res.status(201).json({
      message: "Registrasi berhasil! Cek email untuk verifikasi.",
      token: data.session?.access_token || null,
      refresh_token: data.session?.refresh_token || null,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile.name,
        avatar: profile.avatar,
        provider: data.user.app_metadata?.provider || "email",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// LOGIN dengan email & password
// ================================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error)
      return res.status(401).json({ error: "Email atau password salah" });

    // Pastikan profil di tabel profiles ada
    const profile = await createProfileIfNotExists(data.user);

    res.json({
      message: "Login berhasil",
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile.name,
        avatar: profile.avatar,
        provider: data.user.app_metadata?.provider || "email",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// GOOGLE LOGIN - verifikasi token dari Expo
// ================================
export const googleCallback = async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: "access_token wajib diisi" });
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(access_token);

    if (error || !user) {
      return res.status(401).json({ error: "Token Google tidak valid" });
    }

    // Pastikan profil ada (upsert)
    const profile = await createProfileIfNotExists(user);

    // Build redirect URL ke auth.html dengan token di fragment (#)
    const frontendBase = process.env.EXPO_PUBLIC_FRONTEND_URL || "";
    const redirectUrl = `${frontendBase}/auth.html#access_token=${encodeURIComponent(
      access_token,
    )}&refresh_token=${encodeURIComponent(refresh_token || "")}`;

    // Redirect ke halaman HTML (tidak mengirim JSON lagi)
    return res.redirect(redirectUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// REFRESH TOKEN
// ================================
export const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: "refresh_token wajib diisi" });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error)
      return res
        .status(401)
        .json({ error: "Refresh token tidak valid atau expired" });

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// GET PROFILE
// ================================
export const getProfile = async (req, res) => {
  try {
    // Pastikan profil ada
    const profile = await createProfileIfNotExists(req.user);

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: profile.name,
        avatar: profile.avatar,
        provider: req.user.app_metadata?.provider || "email",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// ================================
// FORGOT PASSWORD
// ================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email wajib diisi" });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Kode OTP telah dikirim ke email kamu." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// VERIFY OTP (Recovery)
// ================================
export const verifyOtp = async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({ error: "Email dan kode OTP wajib diisi" });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "recovery",
    });

    if (error)
      return res.status(400).json({ error: "Kode OTP salah atau expired" });

    res.json({
      message: "OTP valid. Silakan perbarui password Anda.",
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================================
// UPDATE PASSWORD (authenticated)
// ================================
export const updatePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password baru wajib diisi" });
    }

    // Gunakan admin client untuk update user berdasarkan ID dari middleware authenticate
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      { password },
    );

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Password berhasil diperbarui", user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
