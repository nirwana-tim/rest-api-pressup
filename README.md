# Press Up — REST API

API Backend profesional untuk aplikasi **Press Up**, dibangun dengan performa tinggi menggunakan Node.js, Express 5, dan Supabase.

- **Stack**: Node.js + Express 5
- **Database**: [Supabase](https://supabase.com) (PostgreSQL)
- **Auth**: Supabase JWT (Email/Password & Google OAuth)
- **AI Integration**: Groq API via `openai` SDK
- **Infrastructure**: Vercel Serverless Functions

### 📦 Libraries Utama yang Digunakan

- `express` (^5.2.1): Framework backend utama.
- `@supabase/supabase-js` (^2.98.0): Client untuk interaksi database & autentikasi.
- `openai` (^4.0.0+): Digunakan sebagai client untuk menghubungi Groq API (kompatibel).
- `cors` & `helmet`: Middleware untuk keamanan API.
- `dotenv`: Manajemen environment variables.

---

## 🚀 Memulai (Setup Lokal)

### 1. Instalasi

```bash
git clone <repo-url>
cd rest-api-pressup
npm install
```

### 2. Konfigurasi Environment

Buat file `.env` di root project dan isi dengan format berikut:

```env
PORT=3000
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-role-key>
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRES_IN=10d
GROQ_API_KEY=<your-groq-api-key>
PROCESSOR_API_URL=http://localhost:3001
API_SECRET_KEY=pressup_secret_secure_key_2026
```

> [!IMPORTANT]
>
> - `SUPABASE_SERVICE_KEY` adalah **service_role key**. Jangan pernah membagikan key ini ke sisi client/frontend karena memiliki akses penuh (bypass RLS).
> - `PROCESSOR_API_URL` mengarah ke service **rest-api-pressup 2** yang menangani pemrosesan audio berat (transkripsi AssemblyAI & analisis Groq) di belakang layar.
> - `API_SECRET_KEY` adalah kunci rahasia bersama (Shared Secret) untuk mengamankan webhook dari API 1 ke API 2.

### 3. Inisialisasi Database

Jalankan script SQL yang tersedia di [database_setup.md](./database_setup.md) untuk menyiapkan tabel, trigger, dan sistem keamanan (RLS).

### 4. Jalankan Aplikasi

```bash
npm run dev   # Mode development (dengan nodemon)
npm start     # Mode production
```

> **Catatan Arsitektur**: Untuk fitur pemrosesan audio, pastikan **rest-api-pressup 2** juga berjalan secara bersamaan di port 3001. API 1 akan mendelegasikan tugas pemrosesan audio ke API 2 agar response ke mobile lebih cepat.

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

#### 8. Get Profile (Auth)

- **Method**: `GET`
- **URL**: `http://localhost:3000/api/auth/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

---

### 👤 Profil & Progress

#### 9. Get Profile

- **Method**: `GET`
- **URL**: `http://localhost:3000/api/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada
- **Response**:

```json
{
  "profile": {
    "id": "uuid",
    "name": "Nama User",
    "avatar": 1,
    "xp": 0,
    "level": 1
  }
}
```

#### 10. Update Profile

- **Method**: `PUT`
- **URL**: `http://localhost:3000/api/profile`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:

```json
{
  "name": "Nama Baru",
  "xp": 150,
  "level": 2,
  "avatar": 2
}
```

> **Catatan**: `avatar` hanya boleh bernilai 1, 2, atau null.

---

### 🎮 Game Engine (Sessions & Analytics)

#### 11. Create Game Session

- **Method**: `POST`
- **URL**: `http://localhost:3000/api/game/sessions`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:

```json
{
  "duration": 120
}
```

#### 12. Get All Sessions

- **Method**: `GET`
- **URL**: `http://localhost:3000/api/game/sessions`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

#### 13. Update Session Status

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

> **Catatan**: `status` bisa berupa `recording`, `processing`, `completed`, atau `failed`.

#### 14. Save Recording

- **Method**: `POST`
- **URL**: `http://localhost:3000/api/game/recordings`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:

```json
{
  "session_id": "<id-session>",
  "video_url": "https://storage.com/video.mp4",
  "duration": 120,
  "transcript": "Halo semuanya, hari ini saya akan..."
}
```

> **Catatan**: Data akan disimpan ke tabel `audio_recordings` (jika ada `transcript`) dan `video_recordings` (jika ada `video_url`).

#### 15. Upload Video (Sesaat)

- **Method**: `POST`
- **URL**: `http://localhost:3000/api/videos/upload`
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Body (form-data)**:
  - `video`: File video (mp4, dll)
- **Response**:

```json
{
  "message": "Video berhasil diunggah sementara",
  "video_url": "https://...",
  "path": "temp_videos/..."
}
```

> **Catatan**: Video akan dihapus otomatis oleh server jika sudah berumur 2 hari.

#### 16. Trigger Audio Processing (Async)

- **Method**: `POST`
- **URL**: `http://localhost:3000/api/analyze-audio`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:

```json
{
  "sessionId": "<id-session>",
  "audio_url": "https://<your-project>.supabase.co/storage/v1/object/public/session-audios/file.m4a",
  "duration": 120
}
```

- **Response (202 Accepted)**:

```json
{
  "message": "Audio received and is being processed asynchronously",
  "data": {
    "sessionId": "<id-session>",
    "status": "processing"
  }
}
```

> **Catatan**: Endpoint ini tidak melakukan proses berat. Ia hanya memverifikasi URL, mengubah status sesi `game_sessions` menjadi `'processing'`, menyimpan status awal ke `audio_recordings`, lalu melempar tugas analisis ke **API 2** menggunakan header `x-api-secret` di belakang layar agar aplikasi Mobile tidak terkena *timeout*. Hasil akhirnya berupa skor dan status `'completed'` akan diperbarui secara otomatis di tabel `game_sessions` dan `feedbacks` setelah proses AI selesai.

#### 17. Save Feedback

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
  "summary": "Presentasi yang bagus...",
  "improvement_tips": "Coba lihat...",
  "focus_duration": 45.5,
  "unfocus_duration": 15.2,
  "avg_volume": 65.5,
  "tempo": 1,
  "wpm": 120,
  "total_words": 240,
  "repeated_words": ["saya", "dan"]
}
```

> **Catatan**: Jika data teks kosong akan diisi `'none'`, jika data angka kosong akan diisi `0`. `repeated_words` akan disimpan ke tabel `feedback_repeated_words` secara otomatis.

#### 18. Get Session Feedback

- **Method**: `GET`
- **URL**: `http://localhost:3000/api/game/sessions/<id-session>/feedback`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

#### 19. Get Achievements

- **Method**: `GET`
- **URL**: `http://localhost:3000/api/game/achievements`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

---

### 📅 Jadwal Presentasi

#### 20. Get Schedule

- **Method**: `GET`
- **URL**: `http://localhost:3000/api/schedule`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

#### 21. Save Schedule

- **Method**: `POST`
- **URL**: `http://localhost:3000/api/schedule`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body (raw → JSON)**:

```json
{
  "presentation_date": "2026-05-01T10:00:00Z",
  "notification_id": "notif_123"
}
```

> **Catatan**: `presentation_date` harus berupa tanggal di masa depan.

#### 22. Delete Schedule

- **Method**: `DELETE`
- **URL**: `http://localhost:3000/api/schedule`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: ❌ Tidak ada

---

## 🔐 Keamanan & Autentikasi

- **RLS (Row Level Security)**: Aktif di Supabase. User secara otomatis diproteksi agar hanya bisa CRUD data miliknya sendiri.
- **JWT**: Token bersifat stateless. Gunakan `refresh_token` jika access token expired (biasanya 1 jam).

---

## 🗂️ Struktur Folder

```text
src/
├── config/       # Konfigurasi Supabase
├── controllers/  # Logika bisnis (auth.js, games.js, profiles.js, schedules.js)
├── middleware/   # Validasi JWT (auth.js)
└── routes/       # Definisi endpoint (auth.js, games.js, profiles.js, schedules.js)
index.js          # Entry point aplikasi
```

---

## ☁️ Deployment

Aplikasi ini dioptimalkan untuk **Vercel**. Pastikan kamu telah mengatur Environment Variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`) di dashboard Vercel.

?
