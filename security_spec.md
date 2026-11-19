# Security Specification — SIMS SMA Darul Ulum Kepohbaru

## 1. Data Invariants
1. Setiap pengguna terautentikasi wajib memiliki `email_verified == true` dari Google Sign-In.
2. Pengguna baru yang melakukan registrasi mandiri ke `/users/{uid}` hanya diizinkan memperoleh peran default paling rendah (`orang_tua`) dan tidak boleh mengangkat perannya sendiri menjadi `super_admin`, `kepala_sekolah`, `supervisor`, `guru`, `tendik`, atau `wali_kelas`.
3. Hanya Super Admin terverifikasi (`muhajir52@guru.sma.belajar.id` atau akun dengan `role == 'super_admin'` di `/users/{uid}`) yang dapat mengubah peran pengguna lain.
4. Data PII siswa (`/students`, `/grades`, `/attendance`, `/attendance_notifications`) tidak pernah dapat dibaca secara publik maupun melalui kueri daftar bebas (`allow list` tanpa pembatasan peran/kepemilikan). Orang tua hanya dapat membaca data anak yang terhubung dengan `parentEmail == request.auth.token.email`.
5. Hasil supervisi berstatus terminal `Disetujui` terkunci dari modifikasi oleh supervisor non-admin, dan hanya dapat divalidasi oleh `kepala_sekolah` atau `super_admin`.
6. Seluruh `createdAt` dan `updatedAt` wajib cocok dengan `request.time` (server timestamp), dan `createdAt` serta `authorUid` bersifat immutable setelah dibuat.
7. Seluruh `documentId` pada operasi `get`, `create`, `update`, `delete` wajib lolos validasi `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, maks 128 karakter).

## 2. The "Dirty Dozen" Payloads (Adversarial Security Checks)
1. **Self-Privilege Escalation on Create**: User biasa mengirim `{ uid, email, displayName, role: "super_admin", activeStatus: "aktif" }` ke `/users/{uid}` -> **PERMISSION_DENIED**.
2. **Role Tampering on Update**: User biasa mengirim update `{ role: "kepala_sekolah" }` ke dokumen `/users/{uid}` miliknya -> **PERMISSION_DENIED**.
3. **Ghost Field / Shadow Update**: Admin/Guru mengirim `{ ...validStudent, isVerifiedAdmin: true }` ke `/students/{id}` -> **PERMISSION_DENIED**.
4. **Email Spoofing (Unverified Email)**: Token dengan `email: "muhajir52@guru.sma.belajar.id"` tetapi `email_verified: false` -> **PERMISSION_DENIED**.
5. **PII Blanket Read**: Orang tua mencoba `get` `/users/{otherUid}` atau `/students/{otherStudentId}` -> **PERMISSION_DENIED**.
6. **Unauthorized List Scraping**: Orang tua mencoba `list` seluruh `/students` tanpa filter `parentEmail == request.auth.token.email` -> **PERMISSION_DENIED**.
7. **ID Poisoning**: Penulisan dokumen dengan ID berisi karakter path traversal atau >128 karakter -> **PERMISSION_DENIED**.
8. **Client-Forged Timestamp**: Penulisan dokumen dengan `createdAt` palsu (bukan `request.time`) -> **PERMISSION_DENIED**.
9. **Immutable Field Mutation**: Update dokumen mencoba mengubah `authorUid` atau `createdAt` -> **PERMISSION_DENIED**.
10. **Terminal State Bypass**: Supervisor mencoba mengubah nilai `supervision_assessments/{id}` yang sudah berstatus `Disetujui` -> **PERMISSION_DENIED**.
11. **Oversized Payload / DoW**: Penulisan string > batas `maxLength` atau array > batas elemen -> **PERMISSION_DENIED**.
12. **Audit Log Tampering**: Pengguna biasa mencoba menghapus atau mengubah `/activity_logs/{id}` -> **PERMISSION_DENIED**.
