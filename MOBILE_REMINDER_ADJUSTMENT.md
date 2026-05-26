# Mobile Reminder Adjustment

## Tujuan
Mobile tidak perlu mengatur reminder email secara manual. Mobile hanya mengirim jadwal presentasi ke backend. Backend akan membuat reminder email otomatis.

## Endpoint Save Schedule
POST /api/schedule

## Request Body
```json
{
  "presentation_date": "2026-06-20T09:00:00.000Z",
  "presentation_title": "Presentasi Final Project",
  "timezone": "Asia/Jakarta"
}
```

## Catatan
- `presentation_date` tetap dikirim dalam format ISO 8601.
- `timezone` harus berupa timezone IANA yang valid, misalnya `Asia/Jakarta`.
- Mobile tidak perlu mengirim data reminder email satu per satu.
- Jika jadwal diubah, backend otomatis membatalkan pending reminder lama dan membuat pending reminder baru.
- Jika jadwal dihapus, backend otomatis membatalkan pending reminder terkait.
