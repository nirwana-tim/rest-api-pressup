# Press Up - REST API

REST API dengan Node.js + Express + Supabase + JWT + Google OAuth

## Endpoint

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|------------|
| GET | / | ❌ | Health check |
| POST | /api/auth/register | ❌ | Daftar akun baru |
| POST | /api/auth/login | ❌ | Login email & password |
| POST | /api/auth/google | ❌ | Login Google (dari Expo) |
| POST | /api/auth/refresh | ❌ | Refresh token |
| GET | /api/auth/profile | ✅ | Profil user |
| GET | /api/posts | ✅ | Lihat semua posts |
| POST | /api/posts | ✅ | Buat post baru |
| PUT | /api/posts/:id | ✅ | Update post |
| DELETE | /api/posts/:id | ✅ | Hapus post |

## Setup

1. Copy `.env.example` ke `.env` dan isi dengan data Supabase lo
2. `npm install`
3. `npm run dev` untuk development
4. `npm start` untuk production

## Deploy ke Vercel

1. Push ke GitHub
2. Import repo di vercel.com
3. Set Environment Variables (isi dari .env lo)
4. Deploy!

## SQL Supabase

Jalankan di SQL Editor Supabase:

```sql
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own posts" ON posts
  FOR ALL USING (auth.uid() = user_id);
```
