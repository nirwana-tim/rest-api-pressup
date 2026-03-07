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
-- HELPER FUNCTION: Update timestamp otomatis
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabel profiles
CREATE TABLE IF NOT EXISTS profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    xp         INTEGER DEFAULT 0 CHECK (xp >= 0),
    level      INTEGER DEFAULT 1 CHECK (level >= 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and edit own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- 2. Game Sessions
CREATE TABLE IF NOT EXISTS game_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    topic       TEXT NOT NULL,
    duration    INTEGER NOT NULL CHECK (duration > 0),
    total_score DECIMAL(5,2) DEFAULT 0 CHECK (total_score >= 0),
    status      TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'completed', 'failed')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_game_sessions
    BEFORE UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own game sessions" ON game_sessions FOR ALL USING (auth.uid() = user_id);

-- 3. Recordings
CREATE TABLE IF NOT EXISTS recordings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
    audio_url  TEXT,
    video_url  TEXT,
    transcript TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own recordings via session" ON recordings FOR ALL USING (EXISTS (SELECT 1 FROM game_sessions gs WHERE gs.id = recordings.session_id AND gs.user_id = auth.uid()));

-- 4. Feedbacks
CREATE TABLE IF NOT EXISTS feedbacks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
    eye_score        DECIMAL(5,2) CHECK (eye_score BETWEEN 0 AND 100),
    voice_score      DECIMAL(5,2) CHECK (voice_score BETWEEN 0 AND 100),
    filler_score     DECIMAL(5,2) CHECK (filler_score BETWEEN 0 AND 100),
    content_score    DECIMAL(5,2) CHECK (content_score BETWEEN 0 AND 100),
    confidence_score DECIMAL(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
    overall_score    DECIMAL(5,2) GENERATED ALWAYS AS (COALESCE((eye_score + voice_score + filler_score + content_score + confidence_score) / 5, 0)) STORED,
    summary          TEXT,
    improvement_tips TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own feedback via session" ON feedbacks FOR ALL USING (EXISTS (SELECT 1 FROM game_sessions gs WHERE gs.id = feedbacks.session_id AND gs.user_id = auth.uid()));

-- 5. Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, title)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view and manage own achievements" ON achievements FOR ALL USING (auth.uid() = user_id);

-- Legacy table for backward compatibility/reference
CREATE TABLE IF NOT EXISTS posts (
  id         UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID      REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT      NOT NULL,
  content    TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own posts" ON posts FOR ALL USING (auth.uid() = user_id);
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
- `src/controllers`: Logika bisnis (`auth.js`, `posts.js`, `profiles.js`, `games.js`).
- `src/routes`: Jalur API (`auth.js`, `posts.js`, `profiles.js`, `games.js`).
- `src/middleware`: Proteksi route dengan JWT (`auth.js`).
- `src/config`: Koneksi Supabase (`supabase.js`).
