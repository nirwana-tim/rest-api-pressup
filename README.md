# Press Up — REST API

API Backend profesional untuk aplikasi **Press Up**, dibangun dengan performa tinggi menggunakan Node.js, Express 5, dan Supabase.

- **Stack**: Node.js + Express 5
- **Database**: [Supabase](https://supabase.com) (PostgreSQL)
- **Auth**: Supabase JWT (Email/Password & Google OAuth)
- **Infrastructure**: Vercel Serverless Functions

---

## 🚀 Memulai (Setup Lokal)

### 1. Instalasi
```bash
git clone <repo-url>
cd rest-api-pressup
npm install
```

### 2. Konfigurasi Environment
Buat file `.env` di root project dan isi sesuai dengan `.env.example`:
```bash
cp .env.example .env
```
> [!IMPORTANT]
> `SUPABASE_SERVICE_KEY` adalah **service_role key**. Jangan pernah membagikan key ini ke sisi client/frontend karena memiliki akses penuh (bypass RLS).

### 3. Inisialisasi Database
Jalankan script SQL yang tersedia di [database_setup.md](./database_setup.md) untuk menyiapkan tabel, trigger, dan sistem keamanan (RLS).

### 4. Jalankan Aplikasi
```bash
npm run dev   # Mode development (dengan nodemon)
npm start     # Mode production
```

---

## 🧪 Dokumentasi Lengkap & Panduan Testing (Postman)

Gunakan panduan ini untuk mengetes seluruh fitur API secara berurutan.

### 🔐 Autentikasi & Akun

#### 1. Register
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/register`
- **Headers**: `Content-Type: application/json`
- **Body (raw → JSON)**:
```json
{
  "email": "test@gmail.com",
  "password": "rahasia123",
  "name": "Nama Kamu"
}
```

#### 2. Login
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body (raw → JSON)**:
```json
{
  "email": "test@gmail.com",
  "password": "rahasia123"
}
```
> **Catatan**: Simpan `token` dari response untuk digunakan di request selanjutnya sebagai header `Authorization: Bearer <token>`.

#### 3. Google Login
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/google`
- **Headers**: `Content-Type: application/json`
- **Body (raw → JSON)**:
```json
{
  "access_token": "isi_dengan_google_token_dari_client",
  "refresh_token": "opsional"
}
```
> **Catatan**: Endpoint ini akan secara otomatis membuat entry di tabel `profiles` jika user baru pertama kali login.

#### 4. Refresh Token
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/refresh`
- **Headers**: `Content-Type: application/json`
- **Body (raw → JSON)**:
```json
{
  "refresh_token": "isi_dengan_refresh_token"
}
```

#### 5. Forgot Password
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/forgot-password`
- **Headers**: `Content-Type: application/json`
- **Body (raw → JSON)**:
```json
{
  "email": "test@gmail.com"
}
```
> **Catatan**: Supabase akan mengirimkan kode OTP 6-digit ke email untuk recovery.

#### 6. Verify OTP
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/verify-otp`
- **Headers**: `Content-Type: application/json`
- **Body (raw → JSON)**:
```json
{
  "email": "test@gmail.com",
  "token": "123456"
}
```
> **Catatan**: Jika berhasil, endpoint ini mengembalikan `access_token` sementara. Simpan token ini untuk digunakan di langkah selanjutnya.

#### 7. Update Password
- **Method**: `PUT`
- **URL**: `http://localhost:3000/api/auth/update-password`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token_dari_verify_otp>`
- **Body (raw → JSON)**:
```json
{
  "password": "password_baru123"
}
```
> **Penting**: Gunakan token yang didapat dari hasil `Verify OTP` pada header Authorization.

---

### 👤 Profil & Progress

#### 7. Get Profile
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

#### 8. Update Profile
- **Method**: `PUT`
- **URL**: `http://localhost:3000/api/profile`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:
```json
{
  "name": "Nama Baru",
  "xp": 150,
  "level": 2
}
```

---

### 🎮 Game Engine (Sessions & Analytics)

#### 9. Create Game Session
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/game/sessions`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:
```json
{
  "topic": "Public Speaking 101",
  "duration": 120
}
```

#### 10. Get All Sessions
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/game/sessions`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

#### 11. Update Session Status
- **Method**: `PUT`
- **URL**: `http://localhost:3000/api/game/sessions/<id-session>`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:
```json
{
  "status": "completed",
  "total_score": 85.5
}
```

#### 12. Save Recording
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/game/recordings`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:
```json
{
  "session_id": "<id-session>",
  "audio_url": "https://storage.com/audio.mp3",
  "video_url": "https://storage.com/video.mp4",
  "transcript": "Halo semuanya, hari ini saya akan..."
}
```

#### 13. Save Feedback
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/game/feedback`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:
```json
{
  "session_id": "<id-session>",
  "eye_score": 80,
  "voice_score": 75,
  "filler_score": 90,
  "content_score": 85,
  "confidence_score": 88,
  "summary": "Presentasi yang bagus, kontak mata perlu ditingkatkan.",
  "improvement_tips": "Coba lihat ke kamera lebih sering."
}
```

#### 14. Get Session Feedback
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/game/sessions/<id-session>/feedback`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

#### 15. Get Achievements
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/game/achievements`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

---


---

## 🔐 Keamanan & Autentikasi
- **RLS (Row Level Security)**: Aktif di Supabase. User secara otomatis diproteksi agar hanya bisa CRUD data miliknya sendiri.
- **JWT**: Token bersifat stateless. Gunakan `refresh_token` jika access token expired (biasanya 1 jam).

---

## 🗂️ Struktur Folder
```text
src/
├── config/       # Konfigurasi Supabase
├── controllers/  # Logika bisnis (auth.js, games.js, profiles.js, posts.js)
├── middleware/   # Validasi JWT (auth.js)
└── routes/       # Definisi endpoint (auth.js, games.js, profiles.js, posts.js)
index.js          # Entry point aplikasi
```

---

## ☁️ Deployment
Aplikasi ini dioptimalkan untuk **Vercel**. Pastikan kamu telah mengatur Environment Variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`) di dashboard Vercel.

!

