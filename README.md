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
> **Catatan:** `SUPABASE_SERVICE_KEY` adalah **service_role key** yang bypass Row Level Security (RLS). Jangan pernah expose key ini ke client/frontend!

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

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own posts" ON posts
  FOR ALL USING (auth.uid() = user_id);
```

### 4. Jalankan Server
```bash
npm run dev   # Development
npm start     # Production
```
Server berjalan di: `http://localhost:3000`

---

## 📡 API Endpoints (Ringkasan)

| Method | Endpoint | Auth | Body | Keterangan |
|--------|----------|------|------|------------|
| `GET` | `/` | ❌ | — | Health check |
| `POST` | `/api/auth/register` | ❌ | `email`, `password`, `name` | Daftar akun baru |
| `POST` | `/api/auth/login` | ❌ | `email`, `password` | Login email & password |
| `POST` | `/api/auth/google` | ❌ | `access_token`, `refresh_token` | Login Google (OAuth) |
| `POST` | `/api/auth/refresh` | ❌ | `refresh_token` | Perbarui access token |
| `GET` | `/api/auth/profile` | ✅ | — | Profil user login |
| `GET` | `/api/posts` | ✅ | — | Ambil semua post user |
| `POST` | `/api/posts` | ✅ | `title`, `content` | Buat post baru |
| `PUT` | `/api/posts/:id` | ✅ | `title`, `content` | Update post (partial) |
| `DELETE`| `/api/posts/:id` | ✅ | — | Hapus post |

---

## 🧪 Panduan Testing (Postman)

Gunakan langkah-langika berikut untuk mengetes API secara berurutan:

### 1. Register & Login
- **Register**: `POST` ke `/api/auth/register` dengan JSON body `email`, `password`, `name`.
- **Login**: `POST` ke `/api/auth/login` dengan JSON body `email` & `password`.
- **Penting**: Simpan `token` dari response login untuk request selanjutnya.

### 2. Menggunakan Token di Postman
Untuk semua request yang berlabel ✅ (Auth), tambahkan di tab **Headers**:
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer <token_kamu>` |
*(Atau gunakan tab **Auth** → **Bearer Token** di Postman)*.

### 3. Contoh Body Request

#### **Create Post** (`POST /api/posts`)
```json
{
  "title": "Post Pertama",
  "content": "Isi konten disini"
}
```

#### **Update Post** (`PUT /api/posts/<id>`)
```json
{
  "title": "Judul yang Diubah"
}
```
> `content` boleh tidak dikirim (hanya update yang perlu saja).

#### **Refresh Token** (`POST /api/auth/refresh`)
```json
{
  "refresh_token": "<refresh_token_dari_login>"
}
```

---

## 🔐 Keamanan & Autentikasi
- **RLS (Row Level Security)**: Aktif di Supabase. User secara otomatis diproteksi agar hanya bisa CRUD data miliknya sendiri di database, bahkan jika ID post user lain diketahui.
- **JWT**: Token bersifat stateless. Gunakan `refresh_token` jika access token expired (biasanya 1 jam).

---

## ☁️ Deploy ke Vercel
1. Push repo ke GitHub.
2. Import di [vercel.com](https://vercel.com).
3. Isi **Environment Variables** (URL & Keys).
4. Deploy!

---

## 🗂️ Struktur Proyek
- `index.js`: Entry point & Express setup.
- `src/controllers`: Logika bisnis (Auth & Posts).
- `src/routes`: Definisi jalur API.
- `src/middleware`: Proteksi route dengan JWT.
- `src/config`: Koneksi Supabase.
