#!/usr/bin/env node
import { Command } from 'commander'
import fetch from 'node-fetch'
import fs from 'fs'

const program = new Command()
const CONFIG_FILE = '.api-config.json'

// Load/save config (token tersimpan lokal)
const loadConfig = () => {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE)) } 
  catch { return {} }
}
const saveConfig = (data) => fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2))

program
  .name('myapi')
  .description('CLI untuk REST API dengan Supabase + JWT')
  .version('1.0.0')

// Set base URL
program.command('config <url>')
  .description('Set base URL API')
  .action((url) => {
    saveConfig({ ...loadConfig(), baseUrl: url })
    console.log(`✅ Base URL disimpan: ${url}`)
  })

// Register
program.command('register <email> <password> [name]')
  .description('Daftar akun baru')
  .action(async (email, password, name) => {
    const { baseUrl } = loadConfig()
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })
    const data = await res.json()
    if (data.token) {
      saveConfig({ ...loadConfig(), token: data.token })
      console.log('✅ Registrasi berhasil! Token tersimpan.')
    } else {
      console.error('❌', data.error)
    }
  })

// Login
program.command('login <email> <password>')
  .description('Login dan simpan JWT token')
  .action(async (email, password) => {
    const { baseUrl } = loadConfig()
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (data.token) {
      saveConfig({ ...loadConfig(), token: data.token })
      console.log('✅ Login berhasil! Token tersimpan.')
      console.log('👤 User:', data.user.email)
    } else {
      console.error('❌', data.error)
    }
  })

// Profile
program.command('profile')
  .description('Lihat profil user')
  .action(async () => {
    const { baseUrl, token } = loadConfig()
    const res = await fetch(`${baseUrl}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    console.log('👤 Profile:', JSON.stringify(data.user, null, 2))
  })

// List posts
program.command('posts')
  .description('Lihat semua posts')
  .action(async () => {
    const { baseUrl, token } = loadConfig()
    const res = await fetch(`${baseUrl}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.posts?.length === 0) return console.log('📭 Belum ada post')
    data.posts?.forEach(p => console.log(`[${p.id}] ${p.title}`))
  })

// Create post
program.command('create-post <title> [content]')
  .description('Buat post baru')
  .action(async (title, content) => {
    const { baseUrl, token } = loadConfig()
    const res = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, content })
    })
    const data = await res.json()
    if (data.post) console.log('✅ Post dibuat:', data.post.title)
    else console.error('❌', data.error)
  })

// Delete post
program.command('delete-post <id>')
  .description('Hapus post berdasarkan ID')
  .action(async (id) => {
    const { baseUrl, token } = loadConfig()
    const res = await fetch(`${baseUrl}/api/posts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    console.log(data.message || data.error)
  })

program.parse()