# Panduan Test Postman - rest-api-pressup

Base URL lokal:

```text
http://localhost:3000
```

Saran pakai Postman Environment:

```text
base_url = http://localhost:3000
token =
refresh_token =
session_id =
feedback_id =
```

Untuk endpoint yang butuh login, wajib pakai header:

```text
Authorization: Bearer {{token}}
```

Untuk body JSON, pakai:

```text
Content-Type: application/json
```

Setelah login/register berhasil, simpan `token` dan `refresh_token` dari response ke environment Postman.

---

## 1. Health Check

### GET /

URL:

```text
GET {{base_url}}/
```

Headers:

```text
Tidak wajib
```

Body:

```text
Tidak ada
```

Response OK:

```json
{
  "message": "API is running 🚀"
}
```

---

## 2. Auth

### POST /api/auth/register

URL:

```text
POST {{base_url}}/api/auth/register
```

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "email": "test@example.com",
  "password": "rahasia123",
  "name": "User Test"
}
```

Response OK `201`:

```json
{
  "message": "Registrasi berhasil! Cek email untuk verifikasi.",
  "token": "access_token_atau_null",
  "refresh_token": "refresh_token_atau_null",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "name": "User Test",
    "avatar": null,
    "provider": "email"
  }
}
```

Response error umum:

```json
{
  "error": "Email dan password wajib diisi"
}
```

Catatan: kalau Supabase mewajibkan verifikasi email, `token` bisa `null`. Login baru bisa sukses setelah email dikonfirmasi.

### POST /api/auth/login

URL:

```text
POST {{base_url}}/api/auth/login
```

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "email": "test@example.com",
  "password": "rahasia123"
}
```

Response OK `200`:

```json
{
  "message": "Login berhasil",
  "token": "access_token",
  "refresh_token": "refresh_token",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "name": "User Test",
    "avatar": null,
    "provider": "email"
  }
}
```

Postman Tests untuk auto-save token:

```javascript
const json = pm.response.json();
if (json.token) pm.environment.set("token", json.token);
if (json.refresh_token) pm.environment.set("refresh_token", json.refresh_token);
```

### POST /api/auth/google

URL:

```text
POST {{base_url}}/api/auth/google
```

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "access_token": "google_or_supabase_access_token",
  "refresh_token": "optional_refresh_token"
}
```

Response OK `200`:

```json
{
  "message": "Google login berhasil",
  "token": "access_token",
  "refresh_token": "refresh_token",
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "name": "Nama User",
    "avatar": null,
    "provider": "google"
  }
}
```

### POST /api/auth/refresh

URL:

```text
POST {{base_url}}/api/auth/refresh
```

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "refresh_token": "{{refresh_token}}"
}
```

Response OK `200`:

```json
{
  "token": "access_token_baru",
  "refresh_token": "refresh_token_baru"
}
```

### POST /api/auth/forgot-password

URL:

```text
POST {{base_url}}/api/auth/forgot-password
```

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "email": "test@example.com"
}
```

Response OK `200`:

```json
{
  "message": "Kode OTP telah dikirim ke email kamu."
}
```

### POST /api/auth/verify-otp

URL:

```text
POST {{base_url}}/api/auth/verify-otp
```

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "email": "test@example.com",
  "token": "123456"
}
```

Response OK `200`:

```json
{
  "message": "OTP valid. Silakan perbarui password Anda.",
  "session": {
    "access_token": "access_token",
    "refresh_token": "refresh_token"
  }
}
```

Untuk update password, pakai `session.access_token` sebagai `Authorization: Bearer ...`.

### PUT /api/auth/update-password

URL:

```text
PUT {{base_url}}/api/auth/update-password
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer {{token}}
```

Body:

```json
{
  "password": "password_baru123"
}
```

Response OK `200`:

```json
{
  "message": "Password berhasil diperbarui",
  "user": {
    "id": "uuid"
  }
}
```

### GET /api/auth/profile

URL:

```text
GET {{base_url}}/api/auth/profile
```

Headers:

```text
Authorization: Bearer {{token}}
```

Body:

```text
Tidak ada
```

Response OK `200`:

```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "name": "User Test",
    "avatar": null,
    "provider": "email"
  }
}
```

---

## 3. Profile

### GET /api/profile

URL:

```text
GET {{base_url}}/api/profile
```

Headers:

```text
Authorization: Bearer {{token}}
```

Body:

```text
Tidak ada
```

Response OK `200`:

```json
{
  "profile": {
    "id": "uuid",
    "name": "User Test",
    "avatar": null
  }
}
```

### PUT /api/profile

URL:

```text
PUT {{base_url}}/api/profile
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer {{token}}
```

Body:

```json
{
  "name": "Nama Baru",
  "avatar": 1
}
```

Nilai `avatar` yang valid: `1`, `2`, atau `null`.

Response OK `200`:

```json
{
  "message": "Profil berhasil diperbarui",
  "profile": {
    "id": "uuid",
    "name": "Nama Baru",
    "avatar": 1
  }
}
```

---

## 4. Game Sessions

### POST /api/game/sessions

URL:

```text
POST {{base_url}}/api/game/sessions
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer {{token}}
```

Body:

```json
{
  "duration": 120
}
```

Response OK `201`:

```json
{
  "message": "Session started",
  "session": {
    "id": "session_uuid",
    "user_id": "user_uuid",
    "duration": 120,
    "status": "recording",
    "total_score": null,
    "created_at": "2026-05-19T00:00:00.000Z"
  }
}
```

Postman Tests untuk auto-save `session_id`:

```javascript
const json = pm.response.json();
if (json.session && json.session.id) {
  pm.environment.set("session_id", json.session.id);
}
```

### GET /api/game/sessions

URL:

```text
GET {{base_url}}/api/game/sessions
```

Headers:

```text
Authorization: Bearer {{token}}
```

Body:

```text
Tidak ada
```

Response OK `200`:

```json
{
  "sessions": [
    {
      "id": "session_uuid",
      "user_id": "user_uuid",
      "duration": 120,
      "status": "recording",
      "total_score": null
    }
  ]
}
```

### PUT /api/game/sessions/:id

URL:

```text
PUT {{base_url}}/api/game/sessions/{{session_id}}
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer {{token}}
```

Body:

```json
{
  "status": "completed",
  "total_score": 85
}
```

Status yang dipakai aplikasi: `recording`, `processing`, `completed`, `failed`.

Response OK `200`:

```json
{
  "message": "Session updated",
  "session": {
    "id": "session_uuid",
    "status": "completed",
    "total_score": 85
  }
}
```

---

## 5. Recordings

### POST /api/game/recordings

URL:

```text
POST {{base_url}}/api/game/recordings
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer {{token}}
```

Body untuk simpan transcript saja:

```json
{
  "session_id": "{{session_id}}",
  "transcript": "Halo semuanya, hari ini saya akan melakukan presentasi singkat."
}
```

Body untuk simpan video URL:

```json
{
  "session_id": "{{session_id}}",
  "video_url": "https://example.com/video.mp4",
  "duration": 120
}
```

Body untuk simpan keduanya:

```json
{
  "session_id": "{{session_id}}",
  "video_url": "https://example.com/video.mp4",
  "duration": 120,
  "transcript": "Halo semuanya, hari ini saya akan melakukan presentasi singkat."
}
```

Response OK `201`:

```json
{
  "message": "Recording saved",
  "audio_recording": {
    "id": "audio_uuid",
    "session_id": "session_uuid",
    "transcript": "Halo semuanya..."
  },
  "video_recording": {
    "id": "video_uuid",
    "session_id": "session_uuid",
    "video_url": "https://example.com/video.mp4",
    "duration": 120
  }
}
```

---

## 6. Video Upload

### POST /api/videos/upload

URL:

```text
POST {{base_url}}/api/videos/upload
```

Headers:

```text
Authorization: Bearer {{token}}
```

Body di Postman:

```text
Body -> form-data
Key: video
Type: File
Value: pilih file video
```

Jangan isi manual `Content-Type`; Postman akan membuat `multipart/form-data` beserta boundary otomatis.

Response OK `201`:

```json
{
  "message": "Video berhasil diunggah sementara",
  "video_url": "https://your-project.supabase.co/storage/v1/object/public/videos/temp_videos/file.mp4",
  "path": "temp_videos/file.mp4"
}
```

Error umum:

```json
{
  "error": "Tidak ada file video yang diunggah"
}
```

---

## 7. Audio Processing Async

Endpoint ini mengirim perintah dari `rest-api-pressup` ke `rest-api-pressup2` lewat `PROCESSOR_API_URL`.

Syarat sebelum test:

```text
1. rest-api-pressup jalan di port 3000.
2. rest-api-pressup2 jalan di port 3001.
3. .env rest-api-pressup punya PROCESSOR_API_URL yang benar.
4. .env kedua service punya API_SECRET_KEY yang sama.
5. audio_url harus URL Supabase Storage yang valid dari bucket session-audios.
```

### POST /api/analyze-audio

URL:

```text
POST {{base_url}}/api/analyze-audio
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer {{token}}
```

Body:

```json
{
  "sessionId": "{{session_id}}",
  "audio_url": "https://your-project.supabase.co/storage/v1/object/public/session-audios/sample.m4a",
  "duration": 120
}
```

Validasi body:

```text
sessionId: string, hanya huruf/angka/_/-, max 100 karakter
audio_url: URL valid, harus HTTPS, host harus sama dengan SUPABASE_URL, path harus Supabase Storage object
duration: number integer positif, default max 900 detik
```

Response OK `202`:

```json
{
  "message": "Audio received and is being processed asynchronously",
  "data": {
    "sessionId": "session_uuid",
    "status": "processing"
  }
}
```

Response OK ini berarti API 1 sudah menerima audio dan sudah mengirim perintah background ke API 2. Hasil transkripsi/skor tidak langsung muncul di response ini. Cek hasilnya lewat:

```text
GET {{base_url}}/api/game/sessions/{{session_id}}/feedback
GET {{base_url}}/api/game/sessions
```

Error validasi body:

```json
{
  "message": "Invalid request body",
  "code": "VALIDATION_ERROR",
  "details": {}
}
```

Error URL audio:

```json
{
  "message": "Audio URL host is not allowed",
  "code": "INVALID_AUDIO_URL"
}
```

---

## 8. Feedback

### POST /api/game/feedback

URL:

```text
POST {{base_url}}/api/game/feedback
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer {{token}}
```

Body lengkap:

```json
{
  "session_id": "{{session_id}}",
  "eye_score": 80,
  "voice_score": 75,
  "filler_score": 90,
  "content_score": 85,
  "confidence_score": 88,
  "overall_score": 84,
  "summary": "Presentasi sudah cukup jelas.",
  "improvement_tips": "Kurangi filler words dan pertahankan kontak mata.",
  "focus_duration": 45.5,
  "unfocus_duration": 15.2,
  "avg_volume": 65.5,
  "tempo": 1,
  "wpm": 120,
  "total_words": 240,
  "repeated_words": ["saya", "saya", "dan"]
}
```

Body minimal:

```json
{
  "session_id": "{{session_id}}"
}
```

Field angka kosong akan disimpan `0`, field teks kosong akan disimpan `"none"`.

Response OK `201`:

```json
{
  "message": "Feedback saved",
  "feedback": {
    "id": "feedback_uuid",
    "session_id": "session_uuid",
    "eye_score": 80,
    "voice_score": 75,
    "filler_score": 90,
    "content_score": 85,
    "confidence_score": 88,
    "overall_score": 84,
    "summary": "Presentasi sudah cukup jelas.",
    "improvement_tips": "Kurangi filler words dan pertahankan kontak mata."
  }
}
```

### GET /api/game/sessions/:session_id/feedback

URL:

```text
GET {{base_url}}/api/game/sessions/{{session_id}}/feedback
```

Headers:

```text
Authorization: Bearer {{token}}
```

Body:

```text
Tidak ada
```

Response OK `200`:

```json
{
  "feedback": {
    "id": "feedback_uuid",
    "session_id": "session_uuid",
    "overall_score": 84,
    "summary": "Presentasi sudah cukup jelas."
  }
}
```

Kalau belum ada feedback:

```json
{
  "feedback": null
}
```

---

## 9. Achievements

### GET /api/game/achievements

URL:

```text
GET {{base_url}}/api/game/achievements
```

Headers:

```text
Authorization: Bearer {{token}}
```

Body:

```text
Tidak ada
```

Response OK `200`:

```json
{
  "achievements": [
    {
      "id": "achievement_uuid",
      "user_id": "user_uuid"
    }
  ]
}
```

Kalau belum ada achievement:

```json
{
  "achievements": []
}
```

---

## 10. Schedule

### GET /api/schedule

URL:

```text
GET {{base_url}}/api/schedule
```

Headers:

```text
Authorization: Bearer {{token}}
```

Body:

```text
Tidak ada
```

Response OK `200`:

```json
{
  "schedule": {
    "id": "schedule_uuid",
    "user_id": "user_uuid",
    "presentation_date": "2026-06-01T10:00:00.000Z",
    "notification_id": "notif_123"
  }
}
```

Kalau belum ada jadwal:

```json
{
  "schedule": null
}
```

### POST /api/schedule

URL:

```text
POST {{base_url}}/api/schedule
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer {{token}}
```

Body:

```json
{
  "presentation_date": "2026-06-01T10:00:00.000Z",
  "notification_id": "notif_123"
}
```

`presentation_date` wajib tanggal masa depan.

Response OK `200`:

```json
{
  "message": "Jadwal berhasil disimpan",
  "schedule": {
    "id": "schedule_uuid",
    "user_id": "user_uuid",
    "presentation_date": "2026-06-01T10:00:00.000Z",
    "notification_id": "notif_123"
  }
}
```

Error kalau tanggal sudah lewat:

```json
{
  "error": "Tanggal presentasi harus di masa depan"
}
```

### DELETE /api/schedule

URL:

```text
DELETE {{base_url}}/api/schedule
```

Headers:

```text
Authorization: Bearer {{token}}
```

Body:

```text
Tidak ada
```

Response OK `200`:

```json
{
  "message": "Jadwal berhasil dihapus"
}
```

---

## Error Auth Umum

Token tidak dikirim:

```json
{
  "error": "Token tidak ada atau format salah"
}
```

Token salah/expired:

```json
{
  "error": "Token tidak valid atau expired"
}
```

Data milik user lain atau session tidak ditemukan:

```json
{
  "error": "Session not found or forbidden"
}
```

Route salah:

```json
{
  "error": "Route tidak ditemukan"
}
```

---

## Urutan Test yang Disarankan

1. `GET /`
2. `POST /api/auth/register`
3. `POST /api/auth/login`
4. Simpan `token` dan `refresh_token`
5. `GET /api/auth/profile`
6. `GET /api/profile`
7. `PUT /api/profile`
8. `POST /api/game/sessions`
9. Simpan `session_id`
10. `GET /api/game/sessions`
11. `POST /api/game/recordings`
12. `POST /api/game/feedback`
13. `GET /api/game/sessions/{{session_id}}/feedback`
14. `POST /api/schedule`
15. `GET /api/schedule`
16. `DELETE /api/schedule`
17. `POST /api/videos/upload`
18. `POST /api/analyze-audio`

Untuk `POST /api/analyze-audio`, siapkan dulu file audio di Supabase Storage bucket `session-audios` dan pastikan `rest-api-pressup2` sedang jalan.
