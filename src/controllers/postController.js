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

    const { data, error } = await supabaseAdmin
      .from('posts')
      .update({ title, content })
      .eq('id', id)
      .eq('user_id', req.user.id)  // pastikan hanya bisa edit milik sendiri
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Post tidak ditemukan' })

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

    const { error } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)  // pastikan hanya bisa hapus milik sendiri

    if (error) throw error
    res.json({ message: 'Post berhasil dihapus' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
