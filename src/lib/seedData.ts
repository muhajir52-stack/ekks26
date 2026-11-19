import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  GURU_SUPERVISION_INDICATORS,
  GURU_SUPERVISION_INSTRUMENT,
  MASTER_PKKS_INDICATORS,
  MASTER_PKKS_INSTRUMENT,
  TENDIK_SUPERVISION_INDICATORS,
  TENDIK_SUPERVISION_INSTRUMENT,
} from './supervisionMasterData';
import type {
  AcademicEvent,
  AcademicYear,
  Achievement,
  Announcement,
  ArchiveFolder,
  AttendanceNotification,
  AttendanceRecord,
  DigitalArchive,
  GalleryItem,
  GradeRecord,
  NewsArticle,
  PublicDirectoryEntry,
  SchoolClass,
  SchoolContent,
  Student,
  Subject,
  SupervisionSchedule,
  TeacherStaff,
} from '../types/sims';
import { logActivity } from './audit';

export const DEFAULT_PUBLIC_PROFILE: Record<string, Omit<SchoolContent, 'id' | 'updatedByUid'>> = {
  profile: {
    sectionKey: 'profile',
    title: 'SMA Darul Ulum Kepohbaru',
    subtitle: 'Lembaga Pendidikan Islam Modern — Unggul dalam Imtaq, Iptek, dan Akhlakul Karimah',
    body: 'SMA Darul Ulum Kepohbaru berdiri di Kecamatan Kepohbaru, Kabupaten Bojonegoro, Jawa Timur, sebagai institusi pendidikan menengah atas berbasis pesantren dan nilai-nilai Ahlussunnah wal Jamaah yang memadukan Kurikulum Nasional dengan penguatan literasi sains, teknologi digital, dan pembinaan karakter Islami. Sejak didirikan, sekolah terus bertransformasi menjadi ekosistem belajar yang humanis, akuntabel, dan adaptif terhadap perkembangan zaman.',
    items: [
      { label: 'NPSN', value: '20541289', description: 'Terdaftar Kemendikdasmen RI' },
      { label: 'Akreditasi', value: 'A (Unggul)', description: 'BAN-S/M Provinsi Jawa Timur' },
      { label: 'Tahun Berdiri', value: '1998', description: 'Yayasan Pendidikan Darul Ulum Kepohbaru' },
      { label: 'Alamat', value: 'Jl. Raya Kepohbaru No. 45, Bojonegoro', description: 'Jawa Timur 62194' },
    ],
  },
  vision_mission: {
    sectionKey: 'vision_mission',
    title: 'Visi, Misi, dan Tujuan Pendidikan',
    subtitle: 'Landasan Mutu Pembelajaran & Tata Kelola Sekolah',
    body: 'Visi: Terwujudnya Insan Cendekia yang Berakhlak Mulia, Berprestasi Akademik, Terampil Digital, dan Berdaya Saing Global Berlandaskan Nilai Keislaman.',
    items: [
      {
        label: 'Misi 1 — Pembiasaan Islami',
        value: 'Membentuk karakter peserta didik yang beriman, bertakwa, dan berakhlakul karimah melalui pembiasaan ibadah harian dan kajian kitab.',
      },
      {
        label: 'Misi 2 — Mutu Akademik & Literasi',
        value: 'Menyelenggarakan pembelajaran aktif, berdiferensiasi, dan berbasis riset sesuai Kurikulum Nasional dan Rapor Pendidikan.',
      },
      {
        label: 'Misi 3 — Digitalisasi & Kewirausahaan',
        value: 'Mengembangkan kecakapan teknologi informasi, kewirausahaan santri, serta tata kelola administrasi sekolah yang transparan dan akuntabel.',
      },
      {
        label: 'Tujuan Institusi',
        value: 'Menghasilkan lulusan siap melanjutkan ke perguruan tinggi unggulan maupun berkontribusi produktif di tengah masyarakat.',
      },
    ],
  },
  organization: {
    sectionKey: 'organization',
    title: 'Struktur Organisasi Sekolah',
    subtitle: 'Tata Kelola Kepemimpinan & Manajemen Pendidikan',
    body: 'Struktur organisasi SMA Darul Ulum Kepohbaru disusun secara partisipatif untuk menjamin mutu layanan akademik, kesiswaan, sarana prasarana, kehumasan, dan ketatausahaan.',
    items: [
      { label: 'Ketua Yayasan', value: 'KH. Ahmad Syafi’i, M.Pd.I', description: 'Pembina & Penyelenggara Pendidikan' },
      { label: 'Komite Sekolah', value: 'H. Sudirman, S.Sos.', description: 'Mitra Strategis Orang Tua & Masyarakat' },
      { label: 'Kepala Sekolah', value: 'SALIM, S.Pd., M.Pd', description: 'Penanggung Jawab Manajerial, Kewirausahaan & Supervisi' },
      { label: 'Waka Kurikulum', value: 'Muhajir, S.Pd., M.Pd.', description: 'Koordinator KSP, Pembelajaran & Asesmen' },
      { label: 'Waka Kesiswaan', value: 'Siti Aminah, S.Pd.', description: 'Pembinaan OSIS, Ekstrakurikuler & Prestasi' },
      { label: 'Waka Sarpras & Humas', value: 'M. Sholihin, S.T.', description: 'Pengelolaan Sarpras, Kemitraan & Digitalisasi' },
      { label: 'Kepala Tata Usaha', value: 'Nurul Hidayah, S.E.', description: 'Layanan Administrasi & Arsip Digital' },
    ],
  },
  academic_info: {
    sectionKey: 'academic_info',
    title: 'Informasi Akademik & Kurikulum',
    subtitle: 'Kurikulum Merdeka Terintegrasi Nilai Keislaman',
    body: 'SMA Darul Ulum Kepohbaru menerapkan Kurikulum Satuan Pendidikan (KSP) berbasis fase E (Kelas X) dan fase F (Kelas XI–XII) dengan penguatan Projek Penguatan Profil Pelajar Pancasila (P5), bimbingan intensif masuk perguruan tinggi (SNBP/SNBT), kelas tahfidz & literasi kitab kuning, serta ekstrakurikuler riset, pramuka, dan kewirausahaan.',
    items: [
      { label: 'Fase E (Kelas X)', value: '2 Rombel / Program Umum', description: 'Penguatan literasi, numerasi, dan proyek karakter' },
      { label: 'Fase F (Kelas XI & XII)', value: '4 Rombel (2 Rombel Kelas XI & 2 Rombel Kelas XII)', description: 'Paket peminatan dan pendalaman mata pelajaran pilihan PTN' },
      { label: 'Program Khas', value: 'Tahfidz, Riset Karya Ilmiah, & Inkubator Bisnis Siswa', description: 'Terintegrasi dalam jadwal intrakurikuler & kokurikuler' },
    ],
  },
  ppdb: {
    sectionKey: 'ppdb',
    title: 'Penerimaan Peserta Didik Baru (SPMB / PPDB)',
    subtitle: 'Tahun Pelajaran 2026/2027 — SMA Darul Ulum Kepohbaru',
    body: 'Pendaftaran peserta didik baru dibuka melalui jalur Prestasi Akademik/Non-Akademik, Jalur Tahfidz & Beasiswa Yayasan, serta Jalur Reguler. Calon siswa dapat mendaftar secara daring atau langsung di Sekretariat PPDB Kampus SMA Darul Ulum Kepohbaru.',
    items: [
      { label: 'Gelombang I (Prestasi & Tahfidz)', value: '1 Februari – 30 April 2026', description: 'Bebas uang gedung bagi peraih juara minimal tingkat kabupaten atau hafal min. 3 juz' },
      { label: 'Gelombang II (Reguler)', value: '1 Mei – 10 Juli 2026', description: 'Seleksi berkas dan pemetaan kemampuan dasar' },
      { label: 'Persyaratan Umum', value: 'Fotokopi Ijazah/SKL SMP/MTs, KK, Akta Kelahiran, NISN aktif', description: 'Diserahkan ke panitia PPDB / unggah saat daftar ulang' },
      { label: 'Kontak Panitia PPDB', value: '(0353) 551-248 / 0812-3456-7890', description: 'Senin–Sabtu pukul 07.30–14.00 WIB' },
    ],
  },
  contact: {
    sectionKey: 'contact',
    title: 'Kontak & Layanan Informasi',
    subtitle: 'Hubungi Sekretariat SMA Darul Ulum Kepohbaru',
    body: 'Kami melayani informasi akademik, kesiswaan, legalisir ijazah, kemitraan sekolah, dan pengaduan layanan pendidikan secara langsung maupun daring.',
    items: [
      { label: 'Alamat Kampus', value: 'Jl. Raya Kepohbaru No. 45, Kec. Kepohbaru, Kab. Bojonegoro, Jawa Timur 62194' },
      { label: 'Telepon / WhatsApp Resmi', value: '(0353) 551-248 / +62 812-3456-7890' },
      { label: 'Pos-el Resmi', value: 'info@smadukepohbaru.sch.id' },
      { label: 'Jam Layanan', value: 'Senin – Sabtu, 07.00 – 14.30 WIB' },
    ],
  },
};

export const DEFAULT_NEWS: Array<Omit<NewsArticle, 'id' | 'authorUid'>> = [
  {
    title: 'Implementasi Supervisi Digital & Rapor Pendidikan di SMA Darul Ulum Kepohbaru',
    category: 'Tata Kelola',
    summary: 'Sekolah resmi mengintegrasikan instrumen supervisi manajerial, kewirausahaan, dan observasi pembelajaran berbasis web.',
    content: 'SMA Darul Ulum Kepohbaru memperkuat budaya mutu pembelajaran dengan menerapkan Sistem Informasi Manajemen Sekolah (SIMS) terpadu. Kepala sekolah bersama tim penjaminan mutu dan pengawas pembina memanfaatkan instrumen digital untuk memantau kualitas modul ajar, keterlibatan murid, serta dokumentasi bukti fisik secara real-time.',
    publishedDate: '2026-10-12',
    authorName: 'Tim Humas Sekolah',
    isPublished: true,
  },
  {
    title: 'Tim Karya Ilmiah Remaja Raih Medali Emas Kompetisi Riset Pelajar Jawa Timur',
    category: 'Prestasi',
    summary: 'Inovasi bio-komposit ramah lingkungan berbasis limbah pertanian Bojonegoro mengantarkan siswa meraih juara tingkat provinsi.',
    content: 'Siswa kelas XI IPA SMA Darul Ulum Kepohbaru berhasil menjuarai kompetisi riset tingkat Provinsi Jawa Timur melalui penelitian pemanfaatan limbah sekam padi lokal Kepohbaru menjadi papan komposit tahan lembap.',
    publishedDate: '2026-09-28',
    authorName: 'Pembina KIR',
    isPublished: true,
  },
  {
    title: 'Lokakarya Perencanaan Pembelajaran Berdiferensiasi Bersama Komunitas Belajar',
    category: 'Akademik',
    summary: 'Seluruh guru mata pelajaran menyusun Alur Tujuan Pembelajaran dan asesmen diagnostik menyambut semester berjalan.',
    content: 'Melalui komunitas belajar internal sekolah, para pendidik berkolaborasi merancang perangkat ajar kontekstual yang berpijak pada kebutuhan belajar peserta didik dan pemanfaatan media pembelajaran digital.',
    publishedDate: '2026-08-19',
    authorName: 'Waka Kurikulum',
    isPublished: true,
  },
];

export const DEFAULT_ANNOUNCEMENTS: Array<Omit<Announcement, 'id' | 'authorUid'>> = [
  {
    title: 'Jadwal Penilaian Akhir Semester Ganjil Tahun Pelajaran 2026/2027',
    content: 'Penilaian Akhir Semester (PAS) Ganjil akan dilaksanakan secara serentak pada tanggal 1–10 Desember 2026. Seluruh peserta didik kelas X, XI, dan XII diharapkan melengkapi tugas portofolio sebelum ujian berlangsung.',
    audience: 'publik',
    priority: 'penting',
    publishedDate: '2026-11-10',
    authorName: 'Wakil Kepala Bidang Kurikulum',
  },
  {
    title: 'Pembagian Rapor & Pertemuan Wali Murid Akhir Semester',
    content: 'Orang tua/wali siswa diundang hadir dalam forum silaturahmi komite dan penerimaan rapor hasil belajar siswa sekaligus pemantauan kehadiran melalui portal orang tua SIMS.',
    audience: 'orang_tua',
    priority: 'normal',
    publishedDate: '2026-11-15',
    authorName: 'Kepala Sekolah',
  },
];

export const DEFAULT_EVENTS: Array<Omit<AcademicEvent, 'id' | 'authorUid'>> = [
  {
    title: 'Penilaian Akhir Semester (PAS) Ganjil',
    startDate: '2026-12-01',
    endDate: '2026-12-10',
    category: 'Ujian & Asesmen',
    description: 'Pelaksanaan asesmen sumatif akhir semester seluruh tingkat kelas X–XII.',
  },
  {
    title: 'Supervisi Akademik & Observasi Kelas Semester Ganjil',
    startDate: '2026-11-18',
    endDate: '2026-11-28',
    category: 'Supervisi Mutu',
    description: 'Rangkaian observasi kelas, telaah perangkat ajar, dan umpan balik dialogis bersama Kepala Sekolah.',
  },
  {
    title: 'Pekan Proyek P5 Kewirausahaan Santri',
    startDate: '2026-12-12',
    endDate: '2026-12-16',
    category: 'Kewirausahaan',
    description: 'Gelar karya produk kewirausahaan siswa melibatkan orang tua dan mitra UMKM Kepohbaru.',
  },
];

export const DEFAULT_ACHIEVEMENTS: Array<Omit<Achievement, 'id' | 'authorUid'>> = [
  {
    title: 'Juara 1 Lomba Karya Tulis Ilmiah (LKTI) Pelajar Jawa Timur',
    recipientName: 'Ahmad Fauzan & Siti Rahmawati (XI IPA 1)',
    level: 'Provinsi',
    year: '2026',
    category: 'Riset & Sains',
    description: 'Inovasi material ramah lingkungan berbasis sekam padi Kepohbaru.',
  },
  {
    title: 'Juara 2 Olimpiade Sains Nasional (OSN) Bidang Matematika Tingkat Kabupaten',
    recipientName: 'Nadia Putri Lestari (XI IPA 1)',
    level: 'Kabupaten',
    year: '2026',
    category: 'Olimpiade Sains',
    description: 'Lolos seleksi OSN Kabupaten Bojonegoro menuju tingkat Provinsi Jawa Timur.',
  },
  {
    title: 'Juara 1 Musabaqah Tilawatil Quran (MTQ) Pelajar Cabang Fahmil Quran',
    recipientName: 'Tim MTQ SMA Darul Ulum Kepohbaru',
    level: 'Kabupaten',
    year: '2025',
    category: 'Keagamaan',
    description: 'Penghargaan tingkat Kabupaten Bojonegoro.',
  },
];

export const DEFAULT_GALLERY: Array<Omit<GalleryItem, 'id' | 'authorUid'>> = [
  {
    title: 'Upacara Peringatan Hari Santri & Pembiasaan Literasi Pagi',
    mediaType: 'foto',
    category: 'Budaya Sekolah',
    caption: 'Seluruh civitas akademika melaksanakan apel pagi dan pembacaan shalawat bersama di halaman utama.',
    eventDate: '2026-10-22',
  },
  {
    title: 'Praktikum Riset & Pembelajaran Kolaboratif di Laboratorium Digital',
    mediaType: 'foto',
    category: 'Akademik',
    caption: 'Siswa fase F melakukan pengolahan data eksperimen sains menggunakan perangkat digital sekolah.',
    eventDate: '2026-09-14',
  },
  {
    title: 'Forum Komite & Orang Tua Siswa Tahun Pelajaran 2026/2027',
    mediaType: 'video',
    category: 'Kemitraan',
    caption: 'Sosialisasi visi-misi, program RKAS, dan layanan notifikasi kehadiran siswa kepada wali murid.',
    eventDate: '2026-08-05',
  },
];

export const DEFAULT_PUBLIC_DIRECTORY: Array<Omit<PublicDirectoryEntry, 'id' | 'authorUid'>> = [
  { name: 'SALIM, S.Pd., M.Pd', roleType: 'pimpinan', position: 'Kepala Sekolah', subject: 'Manajemen Pendidikan', education: 'S2 Pendidikan' },
  { name: 'Muhajir, S.Pd., M.Pd.', roleType: 'guru', position: 'Waka Kurikulum / Guru', subject: 'Matematika', education: 'S2 Pendidikan Matematika' },
  { name: 'Siti Aminah, S.Pd.', roleType: 'guru', position: 'Waka Kesiswaan / Wali Kelas XI IPA 1', subject: 'Bahasa Indonesia', education: 'S1 Pendidikan Bahasa Indonesia' },
  { name: 'M. Sholihin, S.T.', roleType: 'guru', position: 'Waka Sarpras / Guru', subject: 'Informatika & Fisika', education: 'S1 Teknik' },
  { name: 'Ust. Ahmad Muzakki, M.Ag.', roleType: 'guru', position: 'Guru PAI & Pembina Tahfidz', subject: 'Pendidikan Agama Islam & Aswaja', education: 'S2 Studi Islam' },
  { name: 'Nurul Hidayah, S.E.', roleType: 'tendik', position: 'Kepala Tata Usaha', subject: 'Administrasi & Keuangan Sekolah', education: 'S1 Ekonomi' },
];

export const DEFAULT_ACADEMIC_YEARS: AcademicYear[] = [
  { id: 'ay_2026_ganjil', name: '2026/2027', semester: 'Ganjil', isActive: true, authorUid: 'system' },
  { id: 'ay_2025_genap', name: '2025/2026', semester: 'Genap', isActive: false, authorUid: 'system' },
];

export const DEFAULT_CLASSES: SchoolClass[] = [];

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'sub_pai', code: 'PAI', name: 'Pendidikan Agama Islam & Budi Pekerti', category: 'Umum & Keislaman', kkm: 78, hoursPerWeek: 3, authorUid: 'system' },
  { id: 'sub_mtk', code: 'MTK', name: 'Matematika', category: 'Umum', kkm: 75, hoursPerWeek: 4, authorUid: 'system' },
  { id: 'sub_bind', code: 'BIND', name: 'Bahasa Indonesia', category: 'Umum', kkm: 76, hoursPerWeek: 4, authorUid: 'system' },
  { id: 'sub_bing', code: 'BING', name: 'Bahasa Inggris', category: 'Umum', kkm: 75, hoursPerWeek: 3, authorUid: 'system' },
  { id: 'sub_inf', code: 'INF', name: 'Informatika', category: 'Peminatan & Digital', kkm: 78, hoursPerWeek: 3, authorUid: 'system' },
  { id: 'sub_asw', code: 'ASW', name: 'Ke-NU-an / Aswaja', category: 'Muatan Khas Pesantren', kkm: 80, hoursPerWeek: 2, authorUid: 'system' },
];

export const DEFAULT_TEACHERS: TeacherStaff[] = [];

export const DEFAULT_STUDENTS: Student[] = [];

export const DEFAULT_GRADES: GradeRecord[] = [];

export const DEFAULT_ATTENDANCE: AttendanceRecord[] = [];

export const DEFAULT_ATTENDANCE_NOTIFICATIONS: AttendanceNotification[] = [];

export const DEFAULT_ARCHIVE_FOLDERS: ArchiveFolder[] = [
  // Manajerial
  { id: 'fld_man_1', name: 'Perencanaan Program Sekolah', rootCategory: 'Manajerial', parentFolderId: '', description: 'RKJM, RKT, Visi-Misi, dan KSP SMA Darul Ulum Kepohbaru', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor', 'guru'], authorUid: 'system' },
  { id: 'fld_man_2', name: 'Dokumen Kebijakan', rootCategory: 'Manajerial', parentFolderId: '', description: 'SK Tim Penjamin Mutu, POS Anti-Perundungan, SOP P3K, Tata Tertib', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor', 'guru', 'wali_kelas'], authorUid: 'system' },
  { id: 'fld_man_3', name: 'Rencana Kerja', rootCategory: 'Manajerial', parentFolderId: '', description: 'RKAS, Program Kerja Tahunan Waka, Pembina OSIS & Wali Kelas', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'], authorUid: 'system' },
  { id: 'fld_man_4', name: 'Laporan Kegiatan', rootCategory: 'Manajerial', parentFolderId: '', description: 'LPJ Dana BOS/BOPP, Laporan Sosialisasi, Berita Acara', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'], authorUid: 'system' },
  { id: 'fld_man_5', name: 'Evaluasi Program', rootCategory: 'Manajerial', parentFolderId: '', description: 'EDS, Rapor Pendidikan, Laporan Refleksi Pembelajaran & Sumber Daya', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'], authorUid: 'system' },
  // Kewirausahaan
  { id: 'fld_kew_1', name: 'Program Kewirausahaan', rootCategory: 'Kewirausahaan', parentFolderId: '', description: 'Master Plan Kewirausahaan, MoU Mitra, P5 Kewirausahaan', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor', 'guru'], authorUid: 'system' },
  { id: 'fld_kew_2', name: 'Perencanaan Kegiatan', rootCategory: 'Kewirausahaan', parentFolderId: '', description: 'Pemetaan SWOT, FGD Komite, RKA Inkubator Bisnis Siswa', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'], authorUid: 'system' },
  { id: 'fld_kew_3', name: 'Laporan Pelaksanaan', rootCategory: 'Kewirausahaan', parentFolderId: '', description: 'Laporan Proyek Kewirausahaan & Tracer Study Lulusan', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'], authorUid: 'system' },
  { id: 'fld_kew_4', name: 'Dokumentasi', rootCategory: 'Kewirausahaan', parentFolderId: '', description: 'Brosur Sekolah, Dokumentasi Kegiatan & Kemitraan Masyarakat', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor', 'guru'], authorUid: 'system' },
  { id: 'fld_kew_5', name: 'Evaluasi dan Tindak Lanjut', rootCategory: 'Kewirausahaan', parentFolderId: '', description: 'Refleksi Program Pengembangan Sekolah & RTL Kemitraan', allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'], authorUid: 'system' },
  // Supervisi Tendik
  { id: 'fld_sup_1', name: 'Instrumen Supervisi', rootCategory: 'Supervisi Tendik', parentFolderId: '', description: 'Instrumen Observasi Pembelajaran Guru & Layanan Teknis Tendik', allowedRoles: ['super_admin', 'kepala_sekolah', 'supervisor', 'tendik'], authorUid: 'system' },
  { id: 'fld_sup_2', name: 'Jadwal Supervisi', rootCategory: 'Supervisi Tendik', parentFolderId: '', description: 'Rencana Supervisi Tahunan & Jadwal Observasi GTK', allowedRoles: ['super_admin', 'kepala_sekolah', 'supervisor', 'guru', 'tendik'], authorUid: 'system' },
  { id: 'fld_sup_3', name: 'Hasil Penilaian', rootCategory: 'Supervisi Tendik', parentFolderId: '', description: 'Rekapitulasi Nilai & Lembar Penilaian Kinerja GTK', allowedRoles: ['super_admin', 'kepala_sekolah', 'supervisor'], authorUid: 'system' },
  { id: 'fld_sup_4', name: 'Berita Acara', rootCategory: 'Supervisi Tendik', parentFolderId: '', description: 'Berita Acara Pelaksanaan, Daftar Hadir & Notula Sosialisasi Supervisi', allowedRoles: ['super_admin', 'kepala_sekolah', 'supervisor', 'tendik'], authorUid: 'system' },
  { id: 'fld_sup_5', name: 'Rekomendasi', rootCategory: 'Supervisi Tendik', parentFolderId: '', description: 'Catatan Umpan Balik Dialogis & Rekomendasi Supervisor', allowedRoles: ['super_admin', 'kepala_sekolah', 'supervisor'], authorUid: 'system' },
  { id: 'fld_sup_6', name: 'Tindak Lanjut Supervisi', rootCategory: 'Supervisi Tendik', parentFolderId: '', description: 'Rencana Pengembangan Diri GTK & Laporan Pelatihan Lanjutan', allowedRoles: ['super_admin', 'kepala_sekolah', 'supervisor', 'guru', 'tendik'], authorUid: 'system' },
];

export const DEFAULT_DIGITAL_ARCHIVES: DigitalArchive[] = [
  {
    id: 'arc_seed_1',
    title: 'Dokumen Visi, Misi & SK Tim Penjaminan Mutu SMA Darul Ulum 2026',
    folderId: 'fld_man_1',
    rootCategory: 'Manajerial',
    fileName: 'SK_Visi_Misi_TPM_2026.pdf',
    fileType: 'PDF',
    fileSize: 248000,
    year: '2026',
    documentDate: '2026-07-15',
    description: 'Dokumen penetapan visi-misi sekolah berbasis Rapor Pendidikan dan SK Tim Penjaminan Mutu.',
    currentVersion: 1,
    versions: [{ version: 1, updatedAt: '2026-07-15', updatedBy: 'Administrator', note: 'Unggahan awal dokumen resmi.' }],
    linkedIndicatorCode: '1.1',
    uploadedByName: 'Administrator',
    authorUid: 'system',
  },
  {
    id: 'arc_seed_2',
    title: 'Rencana Kegiatan & Anggaran Sekolah (RKAS) Berbasis Rapor Pendidikan',
    folderId: 'fld_man_3',
    rootCategory: 'Manajerial',
    fileName: 'RKAS_2026_SMA_DU_Kepohbaru.xlsx',
    fileType: 'XLSX',
    fileSize: 185000,
    year: '2026',
    documentDate: '2026-08-01',
    description: 'Rincian rencana kerja anggaran tahunan berorientasi peningkatan mutu pembelajaran.',
    currentVersion: 2,
    versions: [
      { version: 1, updatedAt: '2026-07-20', updatedBy: 'Administrator', note: 'Draf awal RKAS.' },
      { version: 2, updatedAt: '2026-08-01', updatedBy: 'Administrator', note: 'Finalisasi bersama komite sekolah.' },
    ],
    linkedIndicatorCode: '1.4',
    uploadedByName: 'Administrator',
    authorUid: 'system',
  },
  {
    id: 'arc_seed_3',
    title: 'Program & Jadwal Supervisi Akademik GTK Tahun 2026/2027',
    folderId: 'fld_sup_2',
    rootCategory: 'Supervisi Tendik',
    fileName: 'Program_Supervisi_GTK_2026.pdf',
    fileType: 'PDF',
    fileSize: 312000,
    year: '2026',
    documentDate: '2026-09-02',
    description: 'Jadwal observasi pembelajaran guru dan supervisi layanan teknis tenaga kependidikan.',
    currentVersion: 1,
    versions: [{ version: 1, updatedAt: '2026-09-02', updatedBy: 'Administrator', note: 'Dokumen disahkan Kepala Sekolah.' }],
    linkedIndicatorCode: '3.1',
    uploadedByName: 'Administrator',
    authorUid: 'system',
  },
];

export const DEFAULT_SUPERVISION_SCHEDULES: SupervisionSchedule[] = [
  {
    id: 'sch_seed_1',
    instrumentId: 'inst_pkks_2026',
    instrumentTitle: MASTER_PKKS_INSTRUMENT.title,
    academicYearName: '2026/2027',
    period: 'Semester Ganjil 2026',
    targetName: 'SALIM, S.Pd., M.Pd',
    targetRole: 'Kepala Sekolah',
    targetEmail: 'kepsek@smadukepohbaru.sch.id',
    supervisorName: 'Pengawas Pembina & Tim Penjaminan Mutu',
    scheduledDate: '2026-11-24',
    status: 'Berlangsung',
    authorUid: 'system',
  },
  {
    id: 'sch_seed_2',
    instrumentId: 'inst_guru_2026',
    instrumentTitle: GURU_SUPERVISION_INSTRUMENT.title,
    academicYearName: '2026/2027',
    period: 'Semester Ganjil 2026',
    targetName: 'Siti Aminah, S.Pd.',
    targetRole: 'Guru Bahasa Indonesia',
    targetEmail: 'aminah@smadukepohbaru.sch.id',
    supervisorName: 'SALIM, S.Pd., M.Pd',
    scheduledDate: '2026-11-26',
    status: 'Terjadwal',
    authorUid: 'system',
  },
];

export async function seedInitialDatabase(actorName: string): Promise<{ seeded: boolean; message: string }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Pengguna belum terautentikasi.');

  // Check if already seeded by checking supervision_instruments
  const existingInstruments = await getDocs(query(collection(db, 'supervision_instruments'), limit(1)));
  if (!existingInstruments.empty) {
    return { seeded: false, message: 'Data awal institusi sudah tersedia di database.' };
  }

  // 1. Seed School Content (CMS)
  for (const [key, item] of Object.entries(DEFAULT_PUBLIC_PROFILE)) {
    await setDoc(doc(db, 'school_content', key), {
      ...item,
      updatedByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 2. Seed News, Announcements, Events, Achievements, Gallery, Public Directory
  const batch1 = writeBatch(db);
  DEFAULT_NEWS.forEach((n, idx) => {
    batch1.set(doc(db, 'news', `news_seed_${idx + 1}`), { ...n, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  DEFAULT_ANNOUNCEMENTS.forEach((a, idx) => {
    batch1.set(doc(db, 'announcements', `ann_seed_${idx + 1}`), { ...a, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  DEFAULT_EVENTS.forEach((e, idx) => {
    batch1.set(doc(db, 'academic_events', `evt_seed_${idx + 1}`), { ...e, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  DEFAULT_ACHIEVEMENTS.forEach((ac, idx) => {
    batch1.set(doc(db, 'achievements', `ach_seed_${idx + 1}`), { ...ac, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  DEFAULT_GALLERY.forEach((g, idx) => {
    batch1.set(doc(db, 'gallery_items', `gal_seed_${idx + 1}`), { ...g, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  DEFAULT_PUBLIC_DIRECTORY.forEach((d, idx) => {
    batch1.set(doc(db, 'public_directory', `dir_seed_${idx + 1}`), { ...d, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  await batch1.commit();

  // 3. Seed Academic Years, Classes, Subjects, Teachers, Students, Grades, Attendance
  const batch2 = writeBatch(db);
  DEFAULT_ACADEMIC_YEARS.forEach(({ id, ...rest }) => {
    batch2.set(doc(db, 'academic_years', id), {
      ...rest,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  DEFAULT_CLASSES.forEach(({ id, ...rest }) => {
    batch2.set(doc(db, 'classes', id), {
      ...rest,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  DEFAULT_SUBJECTS.forEach(({ id, ...rest }) => {
    batch2.set(doc(db, 'subjects', id), { ...rest, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });

  DEFAULT_TEACHERS.forEach(({ id, ...rest }) => {
    batch2.set(doc(db, 'teachers', id), { ...rest, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });

  DEFAULT_STUDENTS.forEach(({ id, ...rest }) => {
    batch2.set(doc(db, 'students', id), { ...rest, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });

  DEFAULT_GRADES.forEach(({ id, ...rest }) => {
    batch2.set(doc(db, 'grades', id), { ...rest, authorUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });

  DEFAULT_ATTENDANCE.forEach(({ id, ...rest }) => {
    batch2.set(doc(db, 'attendance', id), {
      ...rest,
      recordedByName: actorName,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  DEFAULT_ATTENDANCE_NOTIFICATIONS.forEach(({ id, ...rest }) => {
    batch2.set(doc(db, 'attendance_notifications', id), {
      ...rest,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch2.commit();

  // 4. Seed Digital Archive Folders (3 Root Directories & All Required Subfolders)
  const batch3 = writeBatch(db);
  DEFAULT_ARCHIVE_FOLDERS.forEach(({ id, ...rest }) => {
    batch3.set(doc(db, 'archive_folders', id), {
      ...rest,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  DEFAULT_DIGITAL_ARCHIVES.forEach(({ id, ...rest }) => {
    batch3.set(doc(db, 'digital_archives', id), {
      ...rest,
      uploadedByName: actorName,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch3.commit();

  // 5. Seed Supervision Instruments & All 88 Master Indicators + Guru & Tendik Instruments
  const batch4 = writeBatch(db);
  batch4.set(doc(db, 'supervision_instruments', 'inst_pkks_2026'), {
    ...MASTER_PKKS_INSTRUMENT,
    authorUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch4.set(doc(db, 'supervision_instruments', 'inst_guru_2026'), {
    ...GURU_SUPERVISION_INSTRUMENT,
    authorUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch4.set(doc(db, 'supervision_instruments', 'inst_tendik_2026'), {
    ...TENDIK_SUPERVISION_INSTRUMENT,
    authorUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  MASTER_PKKS_INDICATORS.forEach((ind, idx) => {
    batch4.set(doc(db, 'supervision_indicators', `ind_pkks_${idx + 1}`), {
      instrumentId: 'inst_pkks_2026',
      ...ind,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  GURU_SUPERVISION_INDICATORS.forEach((ind, idx) => {
    batch4.set(doc(db, 'supervision_indicators', `ind_guru_${idx + 1}`), {
      instrumentId: 'inst_guru_2026',
      ...ind,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  TENDIK_SUPERVISION_INDICATORS.forEach((ind, idx) => {
    batch4.set(doc(db, 'supervision_indicators', `ind_tendik_${idx + 1}`), {
      instrumentId: 'inst_tendik_2026',
      ...ind,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  DEFAULT_SUPERVISION_SCHEDULES.forEach(({ id, ...rest }) => {
    batch4.set(doc(db, 'supervision_schedules', id), {
      ...rest,
      authorUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch4.commit();

  await logActivity({
    actorName,
    actorRole: 'super_admin',
    action: 'Inisialisasi Data Master',
    module: 'Sistem Inti',
    details: 'Menyemai data awal SMA Darul Ulum Kepohbaru, struktur 16 folder arsip, dan 88 butir instrumen supervisi master.',
  });

  return {
    seeded: true,
    message: 'Data master SMA Darul Ulum Kepohbaru dan 88 butir instrumen supervisi berhasil diinisialisasi.',
  };
}
