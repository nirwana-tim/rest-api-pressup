import { supabaseAdmin } from '../config/supabase.js'

// ================================
// GET semua posts milik user
// ================================
export const getPosts = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ posts: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// CREATE post baru
// ================================
export const createPost = async (req, res) => {
  try {
    const { title, content } = req.body
    if (!title) return res.status(400).json({ error: 'Title wajib diisi' })

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({ title, content, user_id: req.user.id })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ message: 'Post berhasil dibuat', post: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// UPDATE post
// ================================
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params
    const { title, content } = req.body

    // Validasi: minimal satu field harus dikirim
    if (title === undefined && content === undefined) {
      return res.status(400).json({ error: 'title atau content wajib diisi' })
    }

    // Bangun object update hanya dengan field yang dikirim
    const updates = {}
    if (title !== undefined) updates.title = title
    if (content !== undefined) updates.content = content

    // Gunakan maybeSingle() agar null dikembalikan (bukan error) saat tidak ada baris cocok
    const { data, error } = await supabaseAdmin
      .from('posts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id) // pastikan hanya bisa edit milik sendiri
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Post tidak ditemukan atau bukan milik kamu' })

    res.json({ message: 'Post berhasil diupdate', post: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ================================
// DELETE post
// ================================
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params

    // Cek dulu apakah post ada dan milik user ini
    const { data: existing, error: findError } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (findError) throw findError
    if (!existing) return res.status(404).json({ error: 'Post tidak ditemukan atau bukan milik kamu' })

    const { error } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)

    if (error) throw error
    res.json({ message: 'Post berhasil dihapus' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
