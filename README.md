# Press Up — REST API

REST API untuk aplikasi **Press Up**, dibangun dengan:

- **Runtime**: Node.js + Express 5
- **Auth & Database**: [Supabase](https://supabase.com) (Auth + PostgreSQL)
- **Auth Strategy**: Supabase JWT (email/password + Google OAuth)
- **Deploy**: Vercel (Serverless)

---

## 🚀 Cara Setup Lokal

### 1. Clone & Install

```bash
git clone <repo-url>
cd rest-api-pressup
npm install
```

### 2. Konfigurasi Environment

Copy `.env.example` ke `.env`, lalu isi dengan credential Supabase kamu:

```bash
cp .env.example .env
```

Isi `.env`:

```env
PORT=3000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
```

> **Catatan:** `SUPABASE_SERVICE_KEY` adalah **service_role key** yang bypass Row Level Security (RLS).  
> Jangan pernah expose key ini ke client/frontend!

### 3. Setup Database Supabase

Jalankan SQL berikut di **Supabase → SQL Editor**:

```sql
CREATE TABLE posts (
  id         UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID      REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT      NOT NULL,
  content    TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Aktifkan Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy: user hanya bisa akses post miliknya sendiri
CREATE POLICY "Users see own posts" ON posts
  FOR ALL USING (auth.uid() = user_id);
```

### 4. Jalankan Server

```bash
# Development (hot-reload)
npm run dev

# Production
npm start
```

Server berjalan di: `http://localhost:3000`

---

## 📡 API Endpoints

### Health Check

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| `GET` | `/` | ❌ | `{ "message": "API is running 🚀" }` |

---

### Auth — `/api/auth`

| Method | Endpoint | Auth | Body | Keterangan |
|--------|----------|------|------|------------|
| `POST` | `/api/auth/register` | ❌ | `email`, `password`, `name` | Daftar akun baru |
| `POST` | `/api/auth/login` | ❌ | `email`, `password` | Login email & password |
| `POST` | `/api/auth/google` | ❌ | `access_token`, `refresh_token` | Login Google (dari Expo) |
| `POST` | `/api/auth/refresh` | ❌ | `refresh_token` | Perbarui access token |
| `GET` | `/api/auth/profile` | ✅ JWT | — | Profil user yang sedang login |

**Contoh response login berhasil:**

```json
{
  "message": "Login berhasil",
  "token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Nama User",
    "provider": "email"
  }
}
```

---

### Posts — `/api/posts`

> **Semua endpoint posts wajib mengirim header:**  
> `Authorization: Bearer <token>`

| Method | Endpoint | Body | Keterangan |
|--------|----------|------|------------|
| `GET` | `/api/posts` | — | Ambil semua post milik user |
| `POST` | `/api/posts` | `title` *(wajib)*, `content` | Buat post baru |
| `PUT` | `/api/posts/:id` | `title`, `content` *(min. 1)* | Update post (partial update didukung) |
| `DELETE` | `/api/posts/:id` | — | Hapus post |

**Catatan keamanan:** User hanya bisa membaca, mengubah, dan menghapus post miliknya sendiri. Akses ke post user lain akan mengembalikan `404`.

---

## 🔐 Cara Autentikasi

Setelah login, gunakan `token` (access token) di setiap request yang butuh auth:

```
Authorization: Bearer eyJhbGci...
```

Jika token expired, gunakan endpoint `/api/auth/refresh` dengan `refresh_token` untuk mendapatkan token baru tanpa login ulang.

---

## ☁️ Deploy ke Vercel

1. Push repo ke GitHub
2. Import repo di [vercel.com](https://vercel.com)
3. Tambahkan **Environment Variables** sesuai isi `.env` kamu
4. Klik **Deploy**

File `vercel.json` sudah tersedia dan mengatur routing serverless secara otomatis.

---

## 🗂️ Struktur Proyek

```
rest-api-pressup/
├── index.js                  # Entry point, setup Express & routes
├── vercel.json               # Konfigurasi deploy Vercel
├── .env.example              # Template environment variables
└── src/
    ├── config/
    │   └── supabase.js       # Inisialisasi Supabase client
    ├── middleware/
    │   └── auth.js           # Middleware verifikasi JWT
    ├── controllers/
    │   ├── authController.js # Logic register, login, Google OAuth, refresh, profile
    │   └── postController.js # Logic CRUD posts
    └── routes/
        ├── auth.js           # Route /api/auth/*
        └── posts.js          # Route /api/posts/*
```

!
