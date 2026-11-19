import type { SupervisionIndicator, SupervisionItemScore } from '../types/sims';

export interface MasterIndicatorTemplate {
  sheetCode: string;
  sheetTitle: string;
  sectionCode: string;
  sectionTitle: string;
  orderIndex: number;
  code: string;
  taskOrIndicator: string;
  physicalEvidence: string[];
  inspectionMethod: string;
  generalItemLink: string;
  maxScale: number;
}

export interface SheetSummary {
  sheetCode: string;
  sheetTitle: string;
  totalItems: number;
  filledItems: number;
  unfilledItems: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  predicate: string;
}

export interface SupervisionSectionGroup {
  sectionCode: string;
  sectionTitle: string;
  itemCount: number;
  maxScore: number;
  items: SupervisionIndicator[];
}

export interface SupervisionAspectGroup {
  aspectIndex: number;
  sheetCode: string;
  sheetTitle: string;
  headerTitle: string;
  subtitle: string;
  guidance: string;
  footerNotes?: string[];
  itemCount: number;
  maxScore: number;
  sections: SupervisionSectionGroup[];
}

export function calculatePredicate(percentage: number): string {
  if (percentage >= 91) return 'Sangat Baik';
  if (percentage >= 76) return 'Baik';
  if (percentage >= 61) return 'Cukup (Butuh Perbaikan)';
  if (percentage >= 51) return 'Kurang';
  return 'Sangat Kurang';
}

export function calculateSheetSummary(
  sheetCode: string,
  sheetTitle: string,
  indicators: Pick<SupervisionIndicator, 'id' | 'sheetCode' | 'maxScale'>[],
  itemScores: Record<string, SupervisionItemScore>
): SheetSummary {
  const sheetItems = indicators.filter((ind) => ind.sheetCode === sheetCode);
  const totalItems = sheetItems.length;
  let filledItems = 0;
  let totalScore = 0;
  let maxScore = 0;

  for (const ind of sheetItems) {
    maxScore += ind.maxScale || 4;
    const entry = itemScores[ind.id];
    if (entry && entry.scale && entry.scale >= 1 && entry.scale <= 4) {
      filledItems += 1;
      totalScore += entry.scale;
    }
  }

  const unfilledItems = Math.max(0, totalItems - filledItems);
  const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
  return {
    sheetCode,
    sheetTitle,
    totalItems,
    filledItems,
    unfilledItems,
    totalScore,
    maxScore,
    percentage,
    predicate: calculatePredicate(percentage),
  };
}

export const SHEET_METADATA: Record<
  string,
  { headerTitle: string; subtitle: string; guidance: string; footerNotes?: string[] }
> = {
  utama: {
    headerTitle: 'TUGAS KEPALA SEKOLAH (BERLAKU UNTUK SEMUA KEPALA SEKOLAH)',
    subtitle: 'Lembar Utama — Manajerial, Pengembangan Kewirausahaan, dan Supervisi GTK',
    guidance:
      'Beri tanda ✓ pada satu kolom skala (1–4) untuk setiap butir. Kolom Skor terisi otomatis.',
    footerNotes: [
      'Kepala Sekolah telah menyelesaikan Penilaian kinerja di Ruang GTK sampai pada pemantauan refleksi dan evaluasi.',
      'Kepala Sekolah mendapatkan nilai minimal Baik di PKKS untuk dapat melanjutkan penilaian di Pengelolaan Kinerja di Ruang GTK.',
    ],
  },
  spesifikasi_1: {
    headerTitle: 'INSTRUMEN PENGELOLAAN KINERJA KEPALA SEKOLAH TAHUN 2026',
    subtitle: 'SPESIFIKASI: SIKLUS PENINGKATAN KUALITAS PRAKTIK PEMBELAJARAN',
    guidance:
      'Kepala sekolah memimpin siklus perbaikan praktik mengajar: identifikasi masalah → perencanaan → observasi → umpan balik/refleksi → tindak lanjut → siklus berikutnya. Periksa bahwa siklus berjalan utuh dan berdampak pada praktik di kelas, bukan sekadar kelengkapan administrasi supervisi.',
  },
  spesifikasi_2: {
    headerTitle: 'INSTRUMEN PENGELOLAAN KINERJA KEPALA SEKOLAH TAHUN 2026',
    subtitle: 'SPESIFIKASI: REFLEKSI PROGRAM PENGEMBANGAN KOMPETENSI GURU',
    guidance:
      'Kepala sekolah merefleksikan program pengembangan kompetensi guru dan tenaga kependidikan: dari kebutuhan, perencanaan, pelaksanaan, hingga dampak dan perbaikan program. Butir umum 1.7 diperdalam di sini; periksa kualitas refleksi dan tindak lanjutnya.',
  },
  spesifikasi_3: {
    headerTitle: 'INSTRUMEN PEMBINAAN DAN PENGELOLAAN KINERJA KEPALA SEKOLAH TAHUN 2026',
    subtitle: 'SPESIFIKASI: PRESENTASI VISI-MISI SEKOLAH',
    guidance:
      'Kepala sekolah mempresentasikan visi-misi sekolah. Periksa tiga hal: kualitas rumusan, kualitas penyampaian presentasi, dan bukti bahwa visi-misi benar-benar hidup sebagai budaya sekolah.',
  },
  spesifikasi_4: {
    headerTitle: 'INSTRUMEN PENGELOLAAN KINERJA KEPALA SEKOLAH TAHUN 2026',
    subtitle: 'SPESIFIKASI: PRESENTASI PRAKTIK BAIK KEPEMIMPINAN PEMBELAJARAN',
    guidance:
      'Kepala sekolah mempresentasikan satu praktik baik kepemimpinan pembelajaran. Periksa bahwa praktik berasal dari masalah nyata, dijalankan langkah demi langkah, terbukti berdampak, dan dapat dilanjutkan atau direplikasi.',
  },
  spesifikasi_5: {
    headerTitle: 'INSTRUMEN PENGELOLAAN KINERJA KEPALA SEKOLAH TAHUN 2026',
    subtitle: 'SPESIFIKASI: PRESENTASI PROGRAM SEKOLAH',
    guidance:
      'Kepala sekolah mempresentasikan satu program sekolah (program prioritas yang dipimpinnya). Periksa alur perencanaan berbasis data, pelaksanaan dan akuntabilitas anggaran, serta evaluasi dan tindak lanjutnya.',
  },
  spesifikasi_6: {
    headerTitle: 'INSTRUMEN PENGELOLAAN KINERJA KEPALA SEKOLAH TAHUN 2026',
    subtitle: 'SPESIFIKASI: AKTIVASI KEGIATAN KOMUNITAS BELAJAR',
    guidance:
      'Kepala sekolah menghidupkan komunitas belajar (guru, tenaga kependidikan, dan/atau jejaring antarsekolah). Periksa bahwa komunitas berjalan rutin, bermakna bagi praktik mengajar, dan didukung kepala sekolah, bukan sekadar terbentuk di atas kertas.',
  },
  spesifikasi_7: {
    headerTitle: 'INSTRUMEN PENGELOLAAN KINERJA KEPALA SEKOLAH TAHUN 2026',
    subtitle: 'SPESIFIKASI: MEMANDU PERENCANAAN PEMBELAJARAN',
    guidance:
      'Kepala sekolah memandu guru menyusun perencanaan pembelajaran (alur tujuan pembelajaran, modul ajar, asesmen). Periksa kualitas pemanduan itu sendiri, perangkat yang dihasilkan, dan konsistensi antara perencanaan dan pelaksanaan di kelas. Untuk SMK, perhatikan keterkaitan dengan Tefa/DU-DI; untuk SLB, dengan program pembelajaran individual (PPI).',
  },
};

export const SUPERVISION_ASPECT_ORDER: string[] = [
  'utama',
  'spesifikasi_1',
  'spesifikasi_2',
  'spesifikasi_3',
  'spesifikasi_4',
  'spesifikasi_5',
  'spesifikasi_6',
  'spesifikasi_7',
];

export function groupIndicatorsByAspect(
  indicators: SupervisionIndicator[]
): SupervisionAspectGroup[] {
  const sorted = [...indicators].sort((a, b) => a.orderIndex - b.orderIndex);
  const aspectMap = new Map<
    string,
    {
      sheetCode: string;
      sheetTitle: string;
      sectionMap: Map<string, SupervisionSectionGroup>;
      itemCount: number;
      maxScore: number;
    }
  >();

  for (const ind of sorted) {
    let aspect = aspectMap.get(ind.sheetCode);
    if (!aspect) {
      aspect = {
        sheetCode: ind.sheetCode,
        sheetTitle: ind.sheetTitle,
        sectionMap: new Map(),
        itemCount: 0,
        maxScore: 0,
      };
      aspectMap.set(ind.sheetCode, aspect);
    }

    const secKey = `${ind.sectionCode || ''}::${ind.sectionTitle}`;
    let section = aspect.sectionMap.get(secKey);
    if (!section) {
      section = {
        sectionCode: ind.sectionCode || '',
        sectionTitle: ind.sectionTitle,
        itemCount: 0,
        maxScore: 0,
        items: [],
      };
      aspect.sectionMap.set(secKey, section);
    }

    section.items.push(ind);
    section.itemCount += 1;
    section.maxScore += ind.maxScale || 4;
    aspect.itemCount += 1;
    aspect.maxScore += ind.maxScale || 4;
  }

  const orderedEntries = Array.from(aspectMap.values()).sort((a, b) => {
    const idxA = SUPERVISION_ASPECT_ORDER.indexOf(a.sheetCode);
    const idxB = SUPERVISION_ASPECT_ORDER.indexOf(b.sheetCode);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  return orderedEntries.map((aspect, index) => {
    const meta = SHEET_METADATA[aspect.sheetCode];
    return {
      aspectIndex: index + 1,
      sheetCode: aspect.sheetCode,
      sheetTitle: aspect.sheetTitle,
      headerTitle: meta?.headerTitle || 'INSTRUMEN SUPERVISI DIGITAL',
      subtitle: meta?.subtitle || aspect.sheetTitle,
      guidance: meta?.guidance || '',
      footerNotes: meta?.footerNotes,
      itemCount: aspect.itemCount,
      maxScore: aspect.maxScore,
      sections: Array.from(aspect.sectionMap.values()),
    };
  });
}

export const MASTER_PKKS_INSTRUMENT = {
  code: 'PKKS-2026-MASTER',
  title: 'Instrumen Pengelolaan Kinerja Kepala Sekolah Tahun 2026 (Master 8 Lembar)',
  targetType: 'kepala_sekolah' as const,
  year: '2026',
  description:
    'Instrumen resmi berbasis file master_data.pdf (12 halaman): Tugas Kepala Sekolah Umum (21 butir) dan 7 Spesifikasi Tematik (67 butir). Skor otomatis skala 1–4 dengan validasi nol-kosong.',
};

export const MASTER_PKKS_INDICATORS: MasterIndicatorTemplate[] = [
  // =========================================================================
  // LEMBAR 1: TUGAS KEPALA SEKOLAH (UMUM) - 1. MANAJERIAL (1.1 - 1.11)
  // =========================================================================
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 1,
    code: '1.1',
    taskOrIndicator: 'Merancang dan menyampaikan visi dan misi sekolah sehingga menjadi budaya sekolah yang kuat.',
    physicalEvidence: [
      'Dokumen visi dan misi sekolah',
      'SK Tim Penjaminan Mutu',
      'Data hasil EDS/ Rapor Pendidikan',
      'Laporan kegiatan sosialisasi visi dan misi sekolah kepada seluruh pemangku kepentingan (guru, siswa, orang tua, dan masyarakat).',
      'Foto atau video kegiatan sosialisasi visi-misi sekolah kepada seluruh pemangku kepentingan (guru, siswa, orang tua, dan masyarakat).',
      'Rencana Tindak Lanjut kegiatan sosialisasi visi-misi sekolah kepada seluruh pemangku kepentingan (guru, siswa, orang tua, dan masyarakat).',
      'Dokumen kerja sama dengan pihak lain',
    ],
    inspectionMethod: 'Dokumen, observasi, wawancara',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 2,
    code: '1.2',
    taskOrIndicator: 'Mengelola digitalisasi sekolah',
    physicalEvidence: [
      'Dokumen digitalisasi sekolah (Media komunikasi visi dan misi)',
      'Web Sekolah',
      'Face Book',
      'Instragram',
      'Siniar (Podcast)',
      'Digitalisasi pembelajaran',
      'Digitalisasi administrasi sekolah',
    ],
    inspectionMethod: 'Dokumen, observasi sistem digital',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 3,
    code: '1.3',
    taskOrIndicator: 'Melaksanakan pengembangan kurikulum satuan pendidikan',
    physicalEvidence: [
      'Dokumen kurikulum satuan Pendidikan',
      'Aplikasi e-KSP',
      'Lembar Penetapan',
      'BAB I s.d. BAB VI',
      'Validasi Pengawas',
      'Lampiran (SK Kepala Sekolah Tim Pengembang Satuan Pendidikan, SK Kepala Sekolah Tim Penjamin Mutu, SK Kepala Sekolah Tim Supervisi dan Penilaian, Laporan Bukti Pelaksanaan (undangan, daftar hadir, notula, Foto Kegiatan), Dokumen Singkronisasi Kurikulum dengan DU/DI, Dokumen II, dan Dokumen III).',
    ],
    inspectionMethod: 'Dokumen, validasi',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 4,
    code: '1.4',
    taskOrIndicator: 'Membuat rencana kegiatan dan anggaran sekolah berbasis data Rapor Pendidikan dan berorientasi pada peningkatan kualitas pembelajaran.',
    physicalEvidence: [
      'Dokumen Rencana Kegiatan',
      'Rapor Pendidikan',
      'Rekom Prioritas di Rapor Pendidikan',
      'Dokumen analisis kebutuhan sarana dan prasarana',
      'Rencana pengadaan sarana dan prasarana',
      'Laporan pemanfaatan sarana dan prasarana',
      'Jadwal dan laporan pemeliharaan sarana dan prasarana',
      'Dokumen evaluasi pemanfaatan sarana dan prasarana dalam pembelajaran',
      'Rencana Kegiatan Anggaran Sekolah (RKAS)',
      'Lampiran (SK Kepala Sekolah Tim Pengembang Rancangan kegiatan dan anggaran sekolah)',
    ],
    inspectionMethod: 'Dokumen perencanaan & RKAS',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 5,
    code: '1.5',
    taskOrIndicator: 'Melaksanakan kegiatan dan anggaran sekolah berbasis data rapor pendidikan',
    physicalEvidence: [
      'Dokumen dalam Melaksanakan Kegiatan dan Anggaran sekolah',
      'Analisis kebutuhan pembelajaran',
      'Data Siswa, Guru, dan Tenaga Kependidikan',
      'Data Sarana dan Prasarana Sekolah',
      'Jurnal penggunaan sarpras',
      'MOU dengan rekanan',
      'Daftar pemeliharaan sarpras',
      'Kartu inventaris ruang (KIR)',
      'Laporan Bukti Pelaksanaan (Undangan, Daftar Hadir, Notula, Foto Kegiatan)',
    ],
    inspectionMethod: 'Dokumen pelaksanaan & observasi',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 6,
    code: '1.6',
    taskOrIndicator: 'Melaksanakan refleksi pelaksanaan pembelajaran secara berkala melibatkan guru, murid, orang tua, dan masyarakat',
    physicalEvidence: [
      'Dokumen Hasil Refleksi Pelaksanaan Pembelajaran secara berkala',
      'Modul Ajar yang telah disesuaikan kebijakan terbaru.',
      'Laporan refleksi guru (Jurnal Pembelajaran, grafik hasil belajar murid)',
      'Dokumentasi dan Video kegiatan refleksi',
      'Rencana Tindak lanjut refleksi pelaksanaan pembelajaran secara berkala melibatkan guru, murid, orang tua, dan Masyarakat.',
      'Pengembangan Teaching Factory di SMK (struktur organisasi Tefa, SK tim Tefa, ruang produksi, Pembelajaran berbasis produk, ruang praktik, Mitra jejaring pemasaran produk, dan Dokumen Tefa)',
    ],
    inspectionMethod: 'Dokumen, wawancara',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 7,
    code: '1.7',
    taskOrIndicator: 'Melaksanakan refleksi program pengembangan kompetensi guru dan tenaga kependidikan',
    physicalEvidence: [
      'Dokumen Hasil Refleksi Program Pengembangan Kompetensi Guru dan Tenaga Kependidikan',
      'Program pengembangan profesional (Tujuan program, target peserta, materi pelatihan, metode pelatihan, jadwal pelaksanaan, indikator keberhasilan)',
      'Dokumentasi Kegiatan (Undangan, Daftar Hadir, Foto atau video Kegiatan)',
      'Tindak lanjut refleksi program pengembangan kompetensi guru dan tenaga kependidikan',
    ],
    inspectionMethod: 'Dokumen, wawancara guru',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 8,
    code: '1.8',
    taskOrIndicator: 'Melaksanakan refleksi pengolahan sumber daya secara berkala',
    physicalEvidence: [
      'Dokumen Hasil Refleksi Pengelolaan Sumber Daya Secara Berkala',
      'Rencana Pengelolaan Sumber Daya (Tujuan pengelolaan, jenis sumber daya, strategi, indikator keberhasilan, jadwal pelaksanaan)',
      'Dokumentasi Kegiatan (Foto, video, atau laporan kegiatan penggunaan sumber daya)',
      'Laporan Akhir Refleksi (Analisis kekuatan dan kelemahan pengelolaan sumber daya, rekomendasi perbaikan, dan RTL)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 9,
    code: '1.9',
    taskOrIndicator: 'Melaksanakan penyusunan laporan kegiatan dan anggaran sekolah',
    physicalEvidence: [
      'Dokumen Laporan Pelaksanaan Program dan Anggaran Sekolah',
      'Rencana Kegiatan Jangka Menengah (RKJM) berisi rincian kegiatan untuk 4 tahun.',
      'Rencana Kegiatan Tahunan (RKT) berisi rincian kegiatan untuk setiap semester atau triwulan.',
      'Program Kerja Tahunan Sekolah (Waka, Kakomli, wali kelas, guru, Pembina OSIS, Pembina ektrakurikuler, dll)',
      'Dokumen penyusunan anggaran bersama komite sekolah (Undangan, Daftar Hadir, Notula, Foto Kegiatan)',
      'Dokumen Pelaksanaan (Laporan Kegiatan, Daftar Hadir, Bukti pembayaran, Dokumen kegiatan)',
      'LPJ',
    ],
    inspectionMethod: 'Dokumen keuangan & laporan',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 10,
    code: '1.10',
    taskOrIndicator: 'Mengkomunikasikan laporan kegiatan dan anggaran sekolah kepada guru, peserta didik, orang tua, dan masyarakat',
    physicalEvidence: [
      'Dokumen Mengkomunikasikan Laporan Pelaksanaan Program dan Anggaran Sekolah',
      'Laporan Tahunan Sekolah (rangkuman komprehensif dari seluruh kegiatan sekolah selama satu tahun, termasuk pencapaian akademik, kegiatan ekstrakurikuler, penggunaan anggaran, dan rencana ke depan)',
      'Laporan Dana (BOS, BOPP, Partisipasi Masyarakat, dan sumber-sumber lain)',
      'Papan/baner publikasi',
      'Buletin Sekolah (berupa majalah dinding, website sekolah, atau media sosial)',
      'Dokumentasi Kegiatan (Undangan, Daftar Hadir, Foto atau video Kegiatan)',
    ],
    inspectionMethod: 'Dokumen, observasi publikasi',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '1',
    sectionTitle: '1. Manajerial',
    orderIndex: 11,
    code: '1.11',
    taskOrIndicator: 'Iklim Lingkungan Belajar',
    physicalEvidence: [
      'RKT',
      'E RKAS',
      'Kalender Akademik',
      'Foto Lingkungan Belajar',
      'Jadwal Pelajaran',
      'Dokumen pembiasaan Literasi',
      'Dokumen Pembiasaan lainnya',
      'Tata Tertib Sekolah',
      'Program Layanan BK',
      'POS tata cara menangani perundungan dan kekerasan di SATPEN',
      'Dokumen sosialisasi dan workshop tentang perundungan',
      'Bukti penanganan kasus perundungan dan kekerasan di sekolah',
      'Laporan penanganan khusus perundungan dan kekerasan di sekolah',
      'Jadwal Pemeriksaan Sarpras',
      'Hasil perbaikan dan perawatan sarpras',
      'SOP P3K',
      'Dokumen sosialisasi tata cara melaksanakan POS P3K dan mitigasi bencana',
      'Dokumentasi senam kebugaran',
      'Dokumen layanan UKS',
      'Jadwal Monitoring kantin sehat',
      'Hasil Monitoring dan tindak lanjut',
      'Daftar makanan / minuman kantin',
      'Dokumentasi sosialisasi',
    ],
    inspectionMethod: 'Dokumen, observasi lingkungan',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 1: 2. PENGEMBANGAN KEWIRAUSAHAAN (2.1 - 2.5)
  // =========================================================================
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '2',
    sectionTitle: '2. Pengembangan Kewirausahaan',
    orderIndex: 12,
    code: '2.1',
    taskOrIndicator: 'Memetakan kebutuhan dan potensi orang tua wali masyarakat dan di lingkungan sekolah untuk perencanaan pengembangan sekolah',
    physicalEvidence: [
      'Dokumen pemetaan kebutuhan dan potensi warga sekolah',
      'Kuesioner (Orang Tua/Wali Murid, Siswa, Guru, dan Masyarakat)',
      'Analisis SWOT keterlibatan masyarakat dalam pengembangan sekolah',
      'Dokumentasi Focus Group Discussion (FGD) membahas isu pengembangan sekolah',
      'Rencana tindak lanjut berdasarkan hasil pemetaan (kegiatan, target, indikator keberhasilan)',
    ],
    inspectionMethod: 'Dokumen, wawancara',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '2',
    sectionTitle: '2. Pengembangan Kewirausahaan',
    orderIndex: 13,
    code: '2.2',
    taskOrIndicator: 'Menyusun program pengembangan sekolah dengan semangat kewirausahaan dan melibatkan orang tua atau wali komunitas dan masyarakat.',
    physicalEvidence: [
      'Dokumen program pengembangan sekolah',
      'Master Plan pengembangan sekolah dengan semangat kewirausahaan',
      'Nota Kesepahaman (MoU) kerjasama pihak eksternal (perusahaan, perguruan tinggi, komunitas)',
      'Surat Pernyataan Keterlibatan orang tua/wali/masyarakat',
      'Kurikulum Intrakurikuler dan Ekstrakurikuler bermuatan nilai kewirausahaan & minat bakat',
      'Dokumentasi Kegiatan (Foto, video, atau artikel pelaksanaan program)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '2',
    sectionTitle: '2. Pengembangan Kewirausahaan',
    orderIndex: 14,
    code: '2.3',
    taskOrIndicator: 'Melaksanakan program pengembangan sekolah dengan semangat kewirausahaan meliputi: pengembangan jiwa kebiasaan inovasi kerja keras tanpa menyerah dan motivasi untuk sukses, pengembangan pembelajaran industri bagi satuan pendidikan vokasi, dan program pemagangan bagi kesehatan pendidikan vokasi.',
    physicalEvidence: [
      'Dokumen laporan pelaksanaan program pengembangan sekolah',
      'Dokumen Perencanaan Proyek Penguatan Profil Pelajar Pancasila (Mendefinisikan profil pelajar yang diharapkan, termasuk karakter-karakter kewirausahaan).',
      'Rencana Pengembangan Sekolah (RPS) yang mengintegrasikan pendidikan kewirausahaan ke dalam seluruh aspek pembelajaran (Kelas Kewirausahaan, Proyek Kewirausahaan, Kunjungan Industri, Kompetisi Kewirausahaan, dan Inkubator Bisnis Siswa).',
      'Profil Lulusan (Deskripsi kompetensi yang diharapkan dimiliki oleh lulusan, baik dari segi pengetahuan, keterampilan, maupun sikap).',
      'Dokumen Tracer study merupakan bagian penting dalam proses penjaminan mutu pendidikan vokasi',
      'Rencana Kegiatan Pemagangan (Dokumen ini berisi rincian kegiatan pemagangan, mulai dari tujuan, sasaran, jadwal pelaksanaan, hingga evaluasi).',
    ],
    inspectionMethod: 'Dokumen, observasi produk/kegiatan',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '2',
    sectionTitle: '2. Pengembangan Kewirausahaan',
    orderIndex: 15,
    code: '2.4',
    taskOrIndicator: 'Melakukan upaya-upaya komunikasi dalam menggalang sumber daya dari orang tua wali peserta didik komunitas dan masyarakat untuk program pengembangan sekolah dengan semangat kewirausahaan.',
    physicalEvidence: [
      'Dokumen upaya-upaya komunikasi dalam menggalang sumber daya',
      'Brosur Sekolah berisi informasi sekolah, prestasi siswa, dan program berjalan',
      'Video Promosi menampilkan kegiatan sekolah, prestasi, dan visi misi',
      'Rencana Kerja dan Anggaran (RKA) rinci per kegiatan, jadwal, dan alokasi anggaran',
    ],
    inspectionMethod: 'Dokumen, media promosi',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '2',
    sectionTitle: '2. Pengembangan Kewirausahaan',
    orderIndex: 16,
    code: '2.5',
    taskOrIndicator: 'Melaksanakan refleksi program pengembangan sekolah dengan semangat kewirausahaan melibatkan orang tua atau wali peserta didik komunitas dan masyarakat.',
    physicalEvidence: [
      'Dokumen hasil refleksi program pengembangan sekolah',
      'Dokumen Perencanaan (Proposal Program, Rencana Kerja dan Anggaran, IKU)',
      'Dokumen Pelaksanaan (Laporan Kegiatan, Dokumentasi, Data Keterlibatan)',
      'Dokumen Evaluasi (Kuesioner, Hasil Observasi, Data Prestasi)',
      'Rencana Tindak Lanjut',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 1: 3. SUPERVISI KEPADA GURU DAN TENAGA KEPENDIDIKAN (3.1 - 3.5)
  // =========================================================================
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '3',
    sectionTitle: '3. Supervisi kepada Guru dan Tenaga Kependidikan',
    orderIndex: 17,
    code: '3.1',
    taskOrIndicator: 'Merencanakan supervisi pembelajaran bagi guru sesuai indikator kualitas pembelajaran pada rapor pendidikan',
    physicalEvidence: [
      'Dokumen perencanaan supervisi bagi guru dan tenaga kependidikan',
      'Program Supervisi (tujuan umum, fokus area dinilai, jadwal pelaksanaan, mekanisme pelaporan)',
      'Instrumen Supervisi (lembar observasi, checklist, atau rubrik penilaian kualitas pembelajaran Rapor Pendidikan)',
      'Sosialisasi Supervisi (foto kegiatan, daftar hadir, notulen)',
      'Evaluasi hasil supervisi dan Rencana Tindak Lanjut',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '3',
    sectionTitle: '3. Supervisi kepada Guru dan Tenaga Kependidikan',
    orderIndex: 18,
    code: '3.2',
    taskOrIndicator: 'Merencanakan supervisi tenaga kependidikan dalam memberikan pelayanan teknis untuk menunjang proses pendidikan',
    physicalEvidence: [
      'Dokumen perencanaan supervisi kinerja tenaga kependidikan',
      'Program Supervisi (tujuan umum, fokus area, jadwal pelaksanaan, mekanisme pelaporan)',
      'Instrumen Supervisi layanan teknis tenaga kependidikan',
      'Sosialisasi Supervisi (foto kegiatan, daftar hadir, notulen)',
      'Evaluasi hasil supervisi dan Rencana Tindak Lanjut',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '3',
    sectionTitle: '3. Supervisi kepada Guru dan Tenaga Kependidikan',
    orderIndex: 19,
    code: '3.3',
    taskOrIndicator: 'Melakukan supervisi untuk peningkatan kinerja GTK berbasis observasi kinerja',
    physicalEvidence: [
      'Dokumen pelaksanaan supervisi peningkatan kinerja GTK',
      'Rencana Supervisi Tahunan',
      'Instrumen Observasi kinerja GTK berdasarkan indikator yang ditetapkan',
      'Jadwal Supervisi detail waktu dan GTK yang diobservasi',
      'Prosedur Pelaksanaan observasi dari persiapan, pelaksanaan, hingga tindak lanjut',
    ],
    inspectionMethod: 'Dokumen, observasi',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '3',
    sectionTitle: '3. Supervisi kepada Guru dan Tenaga Kependidikan',
    orderIndex: 20,
    code: '3.4',
    taskOrIndicator: 'Melakukan supervisi terhadap pengelolaan kinerja guru dan tenaga kependidikan, meliputi: perencanaan kinerja, pelaksanaan, pemantauan, dan pembinaan kinerja, penilaian kinerja, dan tindak lanjut.',
    physicalEvidence: [
      'Dokumen pelakukan supervisi terhadap pengelolaan kinerja guru dan tenaga kependidikan',
      'Perencanaan kinerja (Rencana Kerja Tahunan (RKT) Sekolah, Deskripsi Jabatan, Indikator Kinerja Utama, Kontrak Kinerja)',
      'Pelaksanaan, pemantauan, dan pembinaan kinerja (Laporan Harian/Mingguan, Catatan Supervisi, Laporan Progres, Dokumentasi Hasil Kerja, Catatan Pembinaan)',
      'Penilaian kinerja (Lembar Penilaian Kinerja, Skala Penilaian, Laporan Penilaian Kinerja)',
      'Tindak lanjut (Rencana Pengembangan Diri, Program Pelatihan dan Pengembangan, Surat Keputusan Kenaikan Pangkat/Jabatan)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },
  {
    sheetCode: 'utama',
    sheetTitle: 'Tugas Kepala Sekolah (Umum)',
    sectionCode: '3',
    sectionTitle: '3. Supervisi kepada Guru dan Tenaga Kependidikan',
    orderIndex: 21,
    code: '3.5',
    taskOrIndicator: 'Melakukan refleksi terkait pelaksanaan supervisi guru dan tenaga kependidikan',
    physicalEvidence: [
      'Dokumen refleksi hasil supervisi bagi guru dan tenaga kependidikan',
      'Dokumen Perencanaan Supervisi (Rencana Supervisi Tahunan, Instrumen Supervisi, Jadwal Supervisi)',
      'Dokumen Pelaksanaan Supervisi (Laporan Hasil Supervisi, Catatan Observasi, Dokumentasi Kegiatan)',
      'Dokumen Tindak Lanjut (Rencana Pengembangan GTK, Laporan Pelatihan dan Pengembangan, Dokumentasi Hasil Implementasi)',
    ],
    inspectionMethod: 'Dokumen, wawancara',
    generalItemLink: 'Butir Utama',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 2: SPESIFIKASI 1 - SIKLUS PENINGKATAN KUALITAS PRAKTIK PEMBELAJARAN (10 BUTIR)
  // =========================================================================
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'A',
    sectionTitle: 'A. Identifikasi dan perencanaan siklus',
    orderIndex: 22,
    code: 'S1.1',
    taskOrIndicator: 'Prioritas masalah pembelajaran dirumuskan berdasarkan data',
    physicalEvidence: [
      'Analisis Rapor Pendidikan (indikator kualitas pembelajaran) dan hasil EDS/refleksi',
      'Rumusan masalah prioritas dan target perbaikan yang terukur',
    ],
    inspectionMethod: 'Dokumen, wawancara',
    generalItemLink: '1.4; 3.1',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'A',
    sectionTitle: 'A. Identifikasi dan perencanaan siklus',
    orderIndex: 23,
    code: 'S1.2',
    taskOrIndicator: 'Rencana siklus terdokumentasi',
    physicalEvidence: [
      'Tujuan siklus, guru sasaran, fokus keterampilan mengajar, jadwal, penanggung jawab',
      'Instrumen observasi yang dipakai',
      'Surat tugas/SK tim pendamping (jika ada)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '3.1; 3.3',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'A',
    sectionTitle: 'A. Identifikasi dan perencanaan siklus',
    orderIndex: 24,
    code: 'S1.3',
    taskOrIndicator: 'Kesepakatan pra-observasi dengan guru',
    physicalEvidence: [
      'Formulir/catatan kesepakatan fokus observasi dan indikator keberhasilan',
      'Guru mengetahui aspek yang akan diamati sebelum observasi',
    ],
    inspectionMethod: 'Dokumen, wawancara guru',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan siklus',
    orderIndex: 25,
    code: 'S1.4',
    taskOrIndicator: 'Observasi pembelajaran terlaksana sesuai rencana',
    physicalEvidence: [
      'Lembar observasi terisi dan catatan observasi',
      'Rekap guru yang sudah diobservasi dibanding sasaran',
      'Jadwal pelaksanaan dan realisasinya',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '3.3',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan siklus',
    orderIndex: 26,
    code: 'S1.5',
    taskOrIndicator: 'Umpan balik pasca-observasi berbasis bukti, spesifik, dan dialogis',
    physicalEvidence: [
      'Catatan percakapan pasca-observasi (kekuatan, area perbaikan, kesepakatan tindak lanjut)',
      'Wawancara 1–2 guru tentang pengalaman menerima umpan balik',
    ],
    inspectionMethod: 'Wawancara, dokumen',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan siklus',
    orderIndex: 27,
    code: 'S1.6',
    taskOrIndicator: 'Pendampingan lanjutan bagi guru',
    physicalEvidence: [
      'Jadwal dan catatan coaching/mentoring, kelas model, atau observasi sejawat',
      'Daftar guru yang mendapat pendampingan dan alasan pemilihannya',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '3.4',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, tindak lanjut, dan dampak',
    orderIndex: 28,
    code: 'S1.7',
    taskOrIndicator: 'Refleksi siklus bersama guru memakai data pembelajaran murid',
    physicalEvidence: [
      'Dokumen hasil refleksi siklus',
      'Jurnal pembelajaran dan grafik hasil belajar murid',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.6; 3.5',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, tindak lanjut, dan dampak',
    orderIndex: 29,
    code: 'S1.8',
    taskOrIndicator: 'Rencana tindak lanjut dan siklus berikutnya',
    physicalEvidence: [
      'RTL tertulis dan jadwal siklus berikutnya',
      'Modul ajar/praktik mengajar yang diperbaiki setelah siklus',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.6; 3.1',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, tindak lanjut, dan dampak',
    orderIndex: 30,
    code: 'S1.9',
    taskOrIndicator: 'Bukti perubahan praktik dan dampaknya',
    physicalEvidence: [
      'Perbandingan hasil observasi awal dan observasi ulang',
      'Data Rapor Pendidikan/hasil belajar sebelum dan sesudah',
      'Wawancara guru/murid tentang perubahan di kelas',
    ],
    inspectionMethod: 'Dokumen, observasi, wawancara',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_1',
    sheetTitle: 'Spesifikasi 1: Siklus Peningkatan Kualitas Praktik Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, tindak lanjut, dan dampak',
    orderIndex: 31,
    code: 'S1.10',
    taskOrIndicator: 'Cakupan dan keberlanjutan siklus',
    physicalEvidence: [
      'Seluruh guru terlayani secara bertahap (prioritas guru yang paling membutuhkan)',
      'Siklus masuk dalam RKT/RKAS sehingga berkelanjutan',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.4; 3.4',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 3: SPESIFIKASI 2 - REFLEKSI PROGRAM PENGEMBANGAN KOMPETENSI GURU (10 BUTIR)
  // =========================================================================
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan program',
    orderIndex: 32,
    code: 'S2.1',
    taskOrIndicator: 'Kebutuhan pengembangan kompetensi dipetakan dari data',
    physicalEvidence: [
      'Hasil supervisi, Rapor Pendidikan, hasil asesmen/PKG, dan refleksi guru sebagai dasar pemetaan',
      'Daftar kebutuhan kompetensi per guru atau kelompok guru dan tenaga kependidikan',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.7; 3.1',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan program',
    orderIndex: 33,
    code: 'S2.2',
    taskOrIndicator: 'Program pengembangan profesional terdokumentasi lengkap',
    physicalEvidence: [
      'Tujuan, target peserta, materi, metode, jadwal, dan indikator keberhasilan',
      'Keterkaitan program dengan prioritas peningkatan pembelajaran',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.7',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan program',
    orderIndex: 34,
    code: 'S2.3',
    taskOrIndicator: 'Sumber daya dan kemitraan program',
    physicalEvidence: [
      'Alokasi anggaran program dalam RKAS',
      'Mitra pendukung (KKG/MGMP, BBGP/BGTK, perguruan tinggi, sekolah lain, DU/DI untuk SMK)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.4; 1.8',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan program',
    orderIndex: 35,
    code: 'S2.4',
    taskOrIndicator: 'Program terlaksana dan terdokumentasi',
    physicalEvidence: [
      'Undangan, daftar hadir, materi, foto/video kegiatan',
      'Ragam bentuk: IHT, komunitas belajar, PMM, magang/benchmarking, workshop',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.7',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan program',
    orderIndex: 36,
    code: 'S2.5',
    taskOrIndicator: 'Akses pengembangan kompetensi merata',
    physicalEvidence: [
      'Rekap keikutsertaan seluruh guru dan tenaga kependidikan (termasuk guru baru/honorer)',
      'Pertimbangan keadilan kesempatan dalam penunjukan peserta',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan program',
    orderIndex: 37,
    code: 'S2.6',
    taskOrIndicator: 'Pemantauan penerapan hasil pelatihan',
    physicalEvidence: [
      'Rencana dan catatan pemantauan penerapan di kelas/tugas',
      'Bukti diseminasi/berbagi praktik oleh peserta kepada rekan',
    ],
    inspectionMethod: 'Dokumen, observasi',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, tindak lanjut, dan dampak',
    orderIndex: 38,
    code: 'S2.7',
    taskOrIndicator: 'Refleksi program terstruktur dan melibatkan peserta',
    physicalEvidence: [
      'Dokumen hasil refleksi: ketercapaian indikator, kekuatan, kelemahan',
      'Masukan peserta (angket, FGD, atau umpan balik tertulis)',
    ],
    inspectionMethod: 'Dokumen, wawancara guru',
    generalItemLink: '1.7',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, tindak lanjut, dan dampak',
    orderIndex: 39,
    code: 'S2.8',
    taskOrIndicator: 'Refleksi kepala sekolah atas perannya',
    physicalEvidence: [
      'Catatan evaluasi diri kepala sekolah (keputusan, alokasi sumber daya, pendampingan)',
      'Kemampuan menjelaskan apa yang akan diubah dan alasannya',
    ],
    inspectionMethod: 'Wawancara',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, tindak lanjut, dan dampak',
    orderIndex: 40,
    code: 'S2.9',
    taskOrIndicator: 'Tindak lanjut refleksi terintegrasi dalam perencanaan',
    physicalEvidence: [
      'RTL tertulis dan perbaikan program periode berikutnya',
      'Masuk dalam RKT/RKAS tahun berjalan atau berikutnya',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.7; 1.4',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_2',
    sheetTitle: 'Spesifikasi 2: Refleksi Program Pengembangan Kompetensi Guru',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, tindak lanjut, dan dampak',
    orderIndex: 41,
    code: 'S2.10',
    taskOrIndicator: 'Dampak pada praktik pembelajaran dan kinerja GTK',
    physicalEvidence: [
      'Hasil supervisi/PKG sebelum dan sesudah program',
      'Contoh perubahan praktik mengajar atau layanan tenaga kependidikan',
    ],
    inspectionMethod: 'Dokumen, observasi',
    generalItemLink: '3.4; 3.5',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 4: SPESIFIKASI 3 - PRESENTASI VISI-MISI SEKOLAH (9 BUTIR)
  // =========================================================================
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'A',
    sectionTitle: 'A. Substansi visi-misi',
    orderIndex: 42,
    code: 'S3.1',
    taskOrIndicator: 'Rumusan visi-misi berbasis data dan konteks sekolah',
    physicalEvidence: [
      'Dokumen visi-misi dan dasar perumusannya (Rapor Pendidikan/EDS, karakteristik lingkungan)',
      'Keterkaitan dengan profil lulusan/profil pelajar dan kebutuhan murid',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.1',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'A',
    sectionTitle: 'A. Substansi visi-misi',
    orderIndex: 43,
    code: 'S3.2',
    taskOrIndicator: 'Perumusan partisipatif',
    physicalEvidence: [
      'SK tim, notula dan daftar hadir penyusunan',
      'Keterlibatan guru, murid, komite, orang tua, dan mitra (DU/DI untuk SMK)',
    ],
    inspectionMethod: 'Dokumen, wawancara',
    generalItemLink: '1.1',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'A',
    sectionTitle: 'A. Substansi visi-misi',
    orderIndex: 44,
    code: 'S3.3',
    taskOrIndicator: 'Keselarasan visi-misi dengan perencanaan sekolah',
    physicalEvidence: [
      'Hubungan visi-misi dengan tujuan, KSP, RKJM, RKT, dan RKAS',
      'Program prioritas yang secara nyata menjawab misi',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.3; 1.4; 1.9',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'B',
    sectionTitle: 'B. Presentasi',
    orderIndex: 45,
    code: 'S3.4',
    taskOrIndicator: 'Sistematika dan kejelasan presentasi',
    physicalEvidence: [
      'Alur: kondisi awal, visi, misi, tujuan, strategi, indikator capaian',
      'Bahasa ringkas, komunikatif, dan sesuai waktu',
    ],
    inspectionMethod: 'Presentasi',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'B',
    sectionTitle: 'B. Presentasi',
    orderIndex: 46,
    code: 'S3.5',
    taskOrIndicator: 'Kemampuan menghubungkan visi-misi dengan praktik nyata',
    physicalEvidence: [
      'Contoh konkret praktik pembelajaran dan iklim sekolah yang lahir dari visi-misi',
      'Bukti pendukung (foto, data, produk) yang ditampilkan',
    ],
    inspectionMethod: 'Presentasi, dokumen',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'B',
    sectionTitle: 'B. Presentasi',
    orderIndex: 47,
    code: 'S3.6',
    taskOrIndicator: 'Kemampuan berdialog dan menjawab pertanyaan penilai',
    physicalEvidence: [
      'Pemahaman mendalam terhadap isi visi-misi dan strategi pencapaiannya',
      'Jawaban konsisten dengan dokumen yang diperlihatkan',
    ],
    inspectionMethod: 'Presentasi, wawancara',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'C',
    sectionTitle: 'C. Sosialisasi, budaya, dan evaluasi',
    orderIndex: 48,
    code: 'S3.7',
    taskOrIndicator: 'Sosialisasi kepada seluruh pemangku kepentingan',
    physicalEvidence: [
      'Laporan, foto/video sosialisasi kepada guru, murid, orang tua, masyarakat',
      'Media: web sekolah, media sosial, siniar, banner/papan publikasi',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.1; 1.2; 1.10',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'C',
    sectionTitle: 'C. Sosialisasi, budaya, dan evaluasi',
    orderIndex: 49,
    code: 'S3.8',
    taskOrIndicator: 'Visi-misi terinternalisasi dalam budaya sekolah',
    physicalEvidence: [
      'Pembiasaan, tata tertib, dan kegiatan yang mencerminkan visi-misi',
      'Wawancara singkat 2–3 guru/murid: mampu menyebutkan dan memaknai visi-misi',
    ],
    inspectionMethod: 'Observasi, wawancara',
    generalItemLink: '1.11',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_3',
    sheetTitle: 'Spesifikasi 3: Presentasi Visi-Misi Sekolah',
    sectionCode: 'C',
    sectionTitle: 'C. Sosialisasi, budaya, dan evaluasi',
    orderIndex: 50,
    code: 'S3.9',
    taskOrIndicator: 'Monitoring, evaluasi, dan tindak lanjut pencapaian visi-misi',
    physicalEvidence: [
      'Instrumen/jadwal peninjauan capaian visi-misi secara berkala',
      'RTL dan penyesuaian rumusan/strategi bila diperlukan',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.1; 1.8',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 5: SPESIFIKASI 4 - PRESENTASI PRAKTIK BAIK KEPEMIMPINAN PEMBELAJARAN (9 BUTIR)
  // =========================================================================
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'A',
    sectionTitle: 'A. Substansi praktik baik',
    orderIndex: 51,
    code: 'S4.1',
    taskOrIndicator: 'Praktik berfokus pada kepemimpinan pembelajaran dan berangkat dari masalah nyata',
    physicalEvidence: [
      'Latar belakang, tantangan, dan data pendukung (Rapor Pendidikan, hasil belajar, hasil supervisi)',
      'Bukan kegiatan insidental, melainkan upaya yang terencana',
    ],
    inspectionMethod: 'Presentasi, dokumen',
    generalItemLink: '1.4',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'A',
    sectionTitle: 'A. Substansi praktik baik',
    orderIndex: 52,
    code: 'S4.2',
    taskOrIndicator: 'Langkah penerapan runtut dan dapat ditelusuri',
    physicalEvidence: [
      'Tujuan, strategi, tahapan (mis. kerangka BAGJA atau sejenisnya), waktu, dan pihak terlibat',
      'Keterkaitan setiap langkah dengan tujuan praktik',
    ],
    inspectionMethod: 'Presentasi, dokumen',
    generalItemLink: '1.6',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'A',
    sectionTitle: 'A. Substansi praktik baik',
    orderIndex: 53,
    code: 'S4.3',
    taskOrIndicator: 'Keterlibatan guru, murid, orang tua, dan mitra',
    physicalEvidence: [
      'Bukti kolaborasi (notula, daftar hadir, dokumentasi)',
      'Peran guru selain kepala sekolah dalam praktik',
    ],
    inspectionMethod: 'Dokumen, wawancara guru',
    generalItemLink: '1.6; 2.2',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Bukti dan dampak',
    orderIndex: 54,
    code: 'S4.4',
    taskOrIndicator: 'Bukti pelaksanaan lengkap',
    physicalEvidence: [
      'Dokumen, foto/video, produk, dan testimoni',
      'Kesesuaian bukti dengan klaim yang dipresentasikan',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.6',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Bukti dan dampak',
    orderIndex: 55,
    code: 'S4.5',
    taskOrIndicator: 'Dampak terukur pada pembelajaran dan murid',
    physicalEvidence: [
      'Data sebelum dan sesudah praktik (hasil belajar, kehadiran, iklim kelas, indikator Rapor Pendidikan)',
      'Perubahan perilaku/praktik guru yang dapat dikonfirmasi',
    ],
    inspectionMethod: 'Dokumen, wawancara',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Bukti dan dampak',
    orderIndex: 56,
    code: 'S4.6',
    taskOrIndicator: 'Refleksi atas kendala dan pembelajaran yang diperoleh',
    physicalEvidence: [
      'Kendala yang dihadapi dan cara mengatasinya',
      'Hal yang akan diperbaiki pada penerapan berikutnya',
    ],
    inspectionMethod: 'Presentasi, dokumen',
    generalItemLink: '1.6; 3.5',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Keberlanjutan dan penyampaian',
    orderIndex: 57,
    code: 'S4.7',
    taskOrIndicator: 'Keberlanjutan dan potensi replikasi',
    physicalEvidence: [
      'Rencana melanjutkan praktik pada tahun berikutnya (RKT/RKAS)',
      'Diseminasi ke sekolah lain/KKKS/komunitas, atau publikasi praktik',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Keberlanjutan dan penyampaian',
    orderIndex: 58,
    code: 'S4.8',
    taskOrIndicator: 'Peran langsung kepala sekolah dapat dikonfirmasi',
    physicalEvidence: [
      'Uraian peran kepala sekolah dalam setiap tahap',
      'Konfirmasi dari guru atau pihak terkait',
    ],
    inspectionMethod: 'Wawancara',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_4',
    sheetTitle: 'Spesifikasi 4: Presentasi Praktik Baik Kepemimpinan Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Keberlanjutan dan penyampaian',
    orderIndex: 59,
    code: 'S4.9',
    taskOrIndicator: 'Kualitas presentasi',
    physicalEvidence: [
      'Sistematis, komunikatif, argumentatif, dan sesuai waktu',
      'Mampu menjawab pertanyaan penilai dengan bukti',
    ],
    inspectionMethod: 'Presentasi',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 6: SPESIFIKASI 5 - PRESENTASI PROGRAM SEKOLAH (10 BUTIR)
  // =========================================================================
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan program',
    orderIndex: 60,
    code: 'S5.1',
    taskOrIndicator: 'Program prioritas dirumuskan dari data dan analisis akar masalah',
    physicalEvidence: [
      'Rapor Pendidikan, rekomendasi prioritas, dan hasil refleksi sebagai dasar',
      'Keterkaitan program dengan peningkatan kualitas pembelajaran/layanan murid',
    ],
    inspectionMethod: 'Dokumen, presentasi',
    generalItemLink: '1.4',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan program',
    orderIndex: 61,
    code: 'S5.2',
    taskOrIndicator: 'Tujuan, sasaran, indikator keberhasilan, jadwal, dan penanggung jawab jelas',
    physicalEvidence: [
      'Dokumen program/proposal dengan indikator yang terukur',
      'Pembagian peran tim pelaksana (SK/surat tugas)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.4',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan program',
    orderIndex: 62,
    code: 'S5.3',
    taskOrIndicator: 'Anggaran program tercantum dan sumber dana jelas',
    physicalEvidence: [
      'Program termuat dalam RKAS/RKT',
      'Sumber dana (BOS, BOPP, partisipasi masyarakat, mitra) dan rincian penggunaan',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.4; 1.5; 1.9',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan program',
    orderIndex: 63,
    code: 'S5.4',
    taskOrIndicator: 'Pelibatan pemangku kepentingan',
    physicalEvidence: [
      'Komite, orang tua, mitra/DU-DI, dan masyarakat terlibat dalam perencanaan',
      'Notula, daftar hadir, MoU/surat pernyataan keterlibatan',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '2.2',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan program',
    orderIndex: 64,
    code: 'S5.5',
    taskOrIndicator: 'Program terlaksana sesuai rencana dan dikawal kepala sekolah',
    physicalEvidence: [
      'Laporan kegiatan, daftar hadir, dokumentasi',
      'Penyesuaian rencana (jika ada) beserta alasannya',
    ],
    inspectionMethod: 'Dokumen, observasi',
    generalItemLink: '1.5',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan program',
    orderIndex: 65,
    code: 'S5.6',
    taskOrIndicator: 'Akuntabilitas pelaksanaan dan keuangan program',
    physicalEvidence: [
      'Bukti pembayaran, LPJ, dan laporan penggunaan dana program',
      'Kesesuaian realisasi dengan RKAS',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.5; 1.9',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'C',
    sectionTitle: 'C. Monitoring, evaluasi, dan presentasi',
    orderIndex: 66,
    code: 'S5.7',
    taskOrIndicator: 'Monitoring dan capaian program dibandingkan indikator',
    physicalEvidence: [
      'Data capaian terhadap target dan indikator keberhasilan',
      'Dampak pada murid, guru, atau iklim sekolah',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'C',
    sectionTitle: 'C. Monitoring, evaluasi, dan presentasi',
    orderIndex: 67,
    code: 'S5.8',
    taskOrIndicator: 'Refleksi dan rencana tindak lanjut program',
    physicalEvidence: [
      'Dokumen refleksi (kekuatan, kendala, rekomendasi)',
      'Keputusan melanjutkan, memperbaiki, atau menghentikan program beserta alasannya',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '2.5; 1.8',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'C',
    sectionTitle: 'C. Monitoring, evaluasi, dan presentasi',
    orderIndex: 68,
    code: 'S5.9',
    taskOrIndicator: 'Komunikasi hasil program kepada publik',
    physicalEvidence: [
      'Laporan/publikasi kepada guru, murid, orang tua, dan masyarakat',
      'Media yang dipakai (banner, buletin, web/medsos)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.10',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_5',
    sheetTitle: 'Spesifikasi 5: Presentasi Program Sekolah',
    sectionCode: 'C',
    sectionTitle: 'C. Monitoring, evaluasi, dan presentasi',
    orderIndex: 69,
    code: 'S5.10',
    taskOrIndicator: 'Kualitas presentasi program',
    physicalEvidence: [
      'Sistematika jelas, data mendukung, komunikatif',
      'Mampu menjawab pertanyaan penilai secara konsisten dengan dokumen',
    ],
    inspectionMethod: 'Presentasi',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 7: SPESIFIKASI 6 - AKTIVASI KEGIATAN KOMUNITAS BELAJAR (10 BUTIR)
  // =========================================================================
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'A',
    sectionTitle: 'A. Pembentukan dan tata kelola',
    orderIndex: 70,
    code: 'S6.1',
    taskOrIndicator: 'Komunitas belajar terbentuk dan ditetapkan',
    physicalEvidence: [
      'SK/surat penugasan, struktur, dan daftar anggota',
      'Jenis komunitas (antarguru di sekolah, per mata pelajaran/rumpun, tenaga kependidikan, lintas sekolah)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'A',
    sectionTitle: 'A. Pembentukan dan tata kelola',
    orderIndex: 71,
    code: 'S6.2',
    taskOrIndicator: 'Fokus komunitas berangkat dari masalah pembelajaran',
    physicalEvidence: [
      'Topik/tujuan komunitas dikaitkan dengan Rapor Pendidikan atau hasil supervisi',
      'Rencana kerja komunitas satu semester/tahun',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.4; 3.1',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'A',
    sectionTitle: 'A. Pembentukan dan tata kelola',
    orderIndex: 72,
    code: 'S6.3',
    taskOrIndicator: 'Waktu dan dukungan disediakan kepala sekolah',
    physicalEvidence: [
      'Jadwal rutin yang terintegrasi dalam jadwal sekolah',
      'Dukungan sumber daya (ruang, anggaran di RKAS, akses digital)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'B',
    sectionTitle: 'B. Aktivasi kegiatan',
    orderIndex: 73,
    code: 'S6.4',
    taskOrIndicator: 'Kegiatan berjalan rutin dan terdokumentasi',
    physicalEvidence: [
      'Undangan, daftar hadir, notula, foto/video, produk kegiatan',
      'Frekuensi pertemuan sesuai jadwal (bandingkan rencana dan realisasi)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.7',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'B',
    sectionTitle: 'B. Aktivasi kegiatan',
    orderIndex: 74,
    code: 'S6.5',
    taskOrIndicator: 'Kepala sekolah berperan sebagai penggerak dan fasilitator',
    physicalEvidence: [
      'Kehadiran dan keterlibatan kepala sekolah dalam sesi komunitas',
      'Bentuk umpan balik/penguatan kepada komunitas',
    ],
    inspectionMethod: 'Observasi, wawancara guru',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'B',
    sectionTitle: 'B. Aktivasi kegiatan',
    orderIndex: 75,
    code: 'S6.6',
    taskOrIndicator: 'Kualitas kolaborasi dan partisipasi',
    physicalEvidence: [
      'Berbagi praktik, observasi sejawat, studi pembelajaran, diskusi buku/artikel, atau refleksi bersama',
      'Persentase guru yang aktif dan keterlibatan lintas mata pelajaran',
    ],
    inspectionMethod: 'Dokumen, observasi',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'B',
    sectionTitle: 'B. Aktivasi kegiatan',
    orderIndex: 76,
    code: 'S6.7',
    taskOrIndicator: 'Pemanfaatan platform digital dan jejaring eksternal',
    physicalEvidence: [
      'Pemanfaatan PMM/grup belajar daring',
      'Keterlibatan KKG/MGMP, sekolah mitra, atau komunitas praktisi',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.2',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, dampak, dan keberlanjutan',
    orderIndex: 77,
    code: 'S6.8',
    taskOrIndicator: 'Monitoring dan refleksi kegiatan komunitas',
    physicalEvidence: [
      'Catatan evaluasi/refleksi berkala komunitas',
      'Umpan balik anggota tentang manfaat kegiatan',
    ],
    inspectionMethod: 'Dokumen, wawancara guru',
    generalItemLink: '1.6; 1.7',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, dampak, dan keberlanjutan',
    orderIndex: 78,
    code: 'S6.9',
    taskOrIndicator: 'Dampak pada praktik mengajar dan hasil belajar',
    physicalEvidence: [
      'Contoh perubahan perangkat ajar atau praktik di kelas setelah kegiatan komunitas',
      'Data hasil belajar atau hasil observasi yang mendukung',
    ],
    inspectionMethod: 'Dokumen, observasi',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_6',
    sheetTitle: 'Spesifikasi 6: Aktivasi Kegiatan Komunitas Belajar',
    sectionCode: 'C',
    sectionTitle: 'C. Refleksi, dampak, dan keberlanjutan',
    orderIndex: 79,
    code: 'S6.10',
    taskOrIndicator: 'Keberlanjutan dan pengembangan komunitas',
    physicalEvidence: [
      'RTL dan masuk dalam RKT/RKAS',
      'Rencana memperluas (murid, orang tua, atau lintas sekolah)',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },

  // =========================================================================
  // LEMBAR 8: SPESIFIKASI 7 - MEMANDU PERENCANAAN PEMBELAJARAN (9 BUTIR)
  // =========================================================================
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'A',
    sectionTitle: 'A. Persiapan memandu',
    orderIndex: 80,
    code: 'S7.1',
    taskOrIndicator: 'Kerangka acuan pemanduan disiapkan',
    physicalEvidence: [
      'Kurikulum satuan pendidikan, CP/ATP, kalender akademik, dan kebijakan pembelajaran terbaru yang berlaku',
      'Panduan/format/contoh perangkat yang disiapkan kepala sekolah',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.3; 1.6',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'A',
    sectionTitle: 'A. Persiapan memandu',
    orderIndex: 81,
    code: 'S7.2',
    taskOrIndicator: 'Perencanaan berpijak pada data kebutuhan belajar murid',
    physicalEvidence: [
      'Hasil asesmen diagnostik dan Rapor Pendidikan',
      'Karakteristik murid (termasuk kebutuhan khusus) yang menjadi dasar perencanaan',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.4; 1.5',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan pemanduan',
    orderIndex: 82,
    code: 'S7.3',
    taskOrIndicator: 'Sesi pemanduan terlaksana',
    physicalEvidence: [
      'Undangan, daftar hadir, notula, foto kegiatan',
      'Materi: ATP, modul ajar, dan asesmen',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.3',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan pemanduan',
    orderIndex: 83,
    code: 'S7.4',
    taskOrIndicator: 'Kualitas pemanduan oleh kepala sekolah',
    physicalEvidence: [
      'Arahan jelas, fasilitasi diskusi, dan pertanyaan pemantik (bukan instruksi satu arah)',
      'Guru merasa terbantu (wawancara 2–3 guru)',
    ],
    inspectionMethod: 'Observasi sesi, wawancara',
    generalItemLink: 'Tambahan',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan pemanduan',
    orderIndex: 84,
    code: 'S7.5',
    taskOrIndicator: 'Mutu perangkat pembelajaran yang dihasilkan',
    physicalEvidence: [
      'Kesesuaian dengan CP/tujuan, diferensiasi, asesmen terintegrasi, penguatan karakter/profil lulusan',
      'Kontekstual: SMK (Tefa/DU-DI), SLB (PPI), atau konteks lokal sekolah',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.6',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Pelaksanaan pemanduan',
    orderIndex: 85,
    code: 'S7.6',
    taskOrIndicator: 'Kolaborasi dan pemanfaatan sumber belajar',
    physicalEvidence: [
      'Penyusunan bersama per mata pelajaran/fase/tim',
      'Pemanfaatan media, sumber belajar, dan teknologi digital',
    ],
    inspectionMethod: 'Dokumen, observasi',
    generalItemLink: '1.2',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Verifikasi, penerapan, dan tindak lanjut',
    orderIndex: 86,
    code: 'S7.7',
    taskOrIndicator: 'Telaah perangkat dan umpan balik kepada guru',
    physicalEvidence: [
      'Catatan telaah/validasi perangkat oleh kepala sekolah',
      'Bukti perbaikan perangkat berdasarkan umpan balik',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '3.1',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Verifikasi, penerapan, dan tindak lanjut',
    orderIndex: 87,
    code: 'S7.8',
    taskOrIndicator: 'Perencanaan diterapkan dalam pembelajaran',
    physicalEvidence: [
      'Hasil observasi pembelajaran menunjukkan kesesuaian dengan modul ajar',
      'Contoh penyesuaian perencanaan saat pelaksanaan',
    ],
    inspectionMethod: 'Dokumen, observasi',
    generalItemLink: '3.3',
    maxScale: 4,
  },
  {
    sheetCode: 'spesifikasi_7',
    sheetTitle: 'Spesifikasi 7: Memandu Perencanaan Pembelajaran',
    sectionCode: 'C',
    sectionTitle: 'C. Verifikasi, penerapan, dan tindak lanjut',
    orderIndex: 88,
    code: 'S7.9',
    taskOrIndicator: 'Refleksi dan rencana tindak lanjut',
    physicalEvidence: [
      'Evaluasi perangkat pada akhir semester',
      'RTL untuk penyempurnaan perencanaan semester/tahun berikutnya',
    ],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.6',
    maxScale: 4,
  },
];

// Instrumen tambahan untuk Supervisi Guru & Tenaga Kependidikan
export const GURU_SUPERVISION_INSTRUMENT = {
  code: 'SUP-GURU-2026',
  title: 'Instrumen Supervisi Akademik & Observasi Pembelajaran Guru',
  targetType: 'guru' as const,
  year: '2026',
  description:
    'Instrumen supervisi perencanaan pembelajaran, observasi pelaksanaan kelas, dan asesmen oleh guru (selaras butir 3.1 dan 3.3 instrumen master).',
};

export const GURU_SUPERVISION_INDICATORS: MasterIndicatorTemplate[] = [
  {
    sheetCode: 'perencanaan',
    sheetTitle: 'Telaah Perangkat & Modul Ajar',
    sectionCode: 'A',
    sectionTitle: 'A. Kelengkapan Perangkat Pembelajaran',
    orderIndex: 1,
    code: 'G1.1',
    taskOrIndicator: 'Keselarasan Alur Tujuan Pembelajaran (ATP) dengan Capaian Pembelajaran dan Kalender Akademik',
    physicalEvidence: ['Dokumen ATP & Prota/Promes', 'Pemetaan CP dan jam efektif'],
    inspectionMethod: 'Dokumen',
    generalItemLink: '3.1; S7.1',
    maxScale: 4,
  },
  {
    sheetCode: 'perencanaan',
    sheetTitle: 'Telaah Perangkat & Modul Ajar',
    sectionCode: 'A',
    sectionTitle: 'A. Kelengkapan Perangkat Pembelajaran',
    orderIndex: 2,
    code: 'G1.2',
    taskOrIndicator: 'Penyusunan Modul Ajar berdiferensiasi sesuai asesmen diagnostik siswa',
    physicalEvidence: ['Modul Ajar lengkap', 'Hasil asesmen awal belajar siswa'],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.6; S7.2',
    maxScale: 4,
  },
  {
    sheetCode: 'perencanaan',
    sheetTitle: 'Telaah Perangkat & Modul Ajar',
    sectionCode: 'A',
    sectionTitle: 'A. Kelengkapan Perangkat Pembelajaran',
    orderIndex: 3,
    code: 'G1.3',
    taskOrIndicator: 'Perencanaan asesmen formatif, sumatif, dan instrumen rubrik penilaian',
    physicalEvidence: ['Kisi-kisi soal dan rubrik penilaian', 'Instrumen asesmen formatif/sumatif'],
    inspectionMethod: 'Dokumen',
    generalItemLink: '3.1; S7.5',
    maxScale: 4,
  },
  {
    sheetCode: 'observasi_kelas',
    sheetTitle: 'Observasi Pelaksanaan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Praktik Mengajar & Interaksi Kelas',
    orderIndex: 4,
    code: 'G2.1',
    taskOrIndicator: 'Kegiatan pendahuluan, apersepsi, penyampaian tujuan, dan kesiapan belajar siswa',
    physicalEvidence: ['Lembar observasi kelas', 'Catatan keterlibatan awal murid'],
    inspectionMethod: 'Observasi kelas',
    generalItemLink: '3.3; S1.4',
    maxScale: 4,
  },
  {
    sheetCode: 'observasi_kelas',
    sheetTitle: 'Observasi Pelaksanaan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Praktik Mengajar & Interaksi Kelas',
    orderIndex: 5,
    code: 'G2.2',
    taskOrIndicator: 'Penguasaan materi, metode aktif, pembelajaran berdiferensiasi, dan integrasi karakter Islami',
    physicalEvidence: ['Lembar observasi inti pembelajaran', 'Media/LKPD yang digunakan'],
    inspectionMethod: 'Observasi kelas',
    generalItemLink: '3.3; S7.8',
    maxScale: 4,
  },
  {
    sheetCode: 'observasi_kelas',
    sheetTitle: 'Observasi Pelaksanaan Pembelajaran',
    sectionCode: 'B',
    sectionTitle: 'B. Praktik Mengajar & Interaksi Kelas',
    orderIndex: 6,
    code: 'G2.3',
    taskOrIndicator: 'Pemanfaatan media digital, refleksi penutup, dan umpan balik kepada peserta didik',
    physicalEvidence: ['Media digital/tayangan pembelajaran', 'Jurnal refleksi pasca-observasi'],
    inspectionMethod: 'Observasi, wawancara',
    generalItemLink: '1.2; S1.5',
    maxScale: 4,
  },
];

export const TENDIK_SUPERVISION_INSTRUMENT = {
  code: 'SUP-TENDIK-2026',
  title: 'Instrumen Supervisi Layanan Teknis Tenaga Kependidikan',
  targetType: 'tendik' as const,
  year: '2026',
  description:
    'Instrumen supervisi kinerja pelayanan administrasi, kearsipan, perpustakaan, laboratorium, dan ketatausahaan (selaras butir 3.2 dan 3.4 instrumen master).',
};

export const TENDIK_SUPERVISION_INDICATORS: MasterIndicatorTemplate[] = [
  {
    sheetCode: 'layanan_teknis',
    sheetTitle: 'Supervisi Layanan Teknis Tendik',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan & Tata Kelola Administrasi',
    orderIndex: 1,
    code: 'T1.1',
    taskOrIndicator: 'Penyusunan program kerja tahunan dan SOP pelayanan administrasi sekolah',
    physicalEvidence: ['Program kerja tahunan TU/Tendik', 'Dokumen SOP layanan administrasi'],
    inspectionMethod: 'Dokumen',
    generalItemLink: '3.2; 3.4',
    maxScale: 4,
  },
  {
    sheetCode: 'layanan_teknis',
    sheetTitle: 'Supervisi Layanan Teknis Tendik',
    sectionCode: 'A',
    sectionTitle: 'A. Perencanaan & Tata Kelola Administrasi',
    orderIndex: 2,
    code: 'T1.2',
    taskOrIndicator: 'Ketertiban pengelolaan arsip digital, persuratan, dan data pokok pendidikan/kesiswaan',
    physicalEvidence: ['Buku agenda surat & arsip digital terklasifikasi', 'Pemutakhiran data siswa & GTK'],
    inspectionMethod: 'Dokumen, observasi sistem',
    generalItemLink: '1.2; 1.5; 3.2',
    maxScale: 4,
  },
  {
    sheetCode: 'layanan_teknis',
    sheetTitle: 'Supervisi Layanan Teknis Tendik',
    sectionCode: 'B',
    sectionTitle: 'B. Kualitas Layanan & Tindak Lanjut',
    orderIndex: 3,
    code: 'T2.1',
    taskOrIndicator: 'Kecepatan, keramahan, dan akuntabilitas layanan teknis bagi guru, siswa, dan orang tua',
    physicalEvidence: ['Log layanan / kepuasan layanan', 'Observasi layanan harian'],
    inspectionMethod: 'Observasi, wawancara',
    generalItemLink: '3.2; 3.3',
    maxScale: 4,
  },
  {
    sheetCode: 'layanan_teknis',
    sheetTitle: 'Supervisi Layanan Teknis Tendik',
    sectionCode: 'B',
    sectionTitle: 'B. Kualitas Layanan & Tindak Lanjut',
    orderIndex: 4,
    code: 'T2.2',
    taskOrIndicator: 'Pelaporan berkala, pemeliharaan sarana/inventaris ruang (KIR), dan refleksi tindak lanjut',
    physicalEvidence: ['Kartu Inventaris Ruang (KIR) & daftar pemeliharaan', 'Laporan evaluasi dan RTL layanan'],
    inspectionMethod: 'Dokumen',
    generalItemLink: '1.5; 3.5',
    maxScale: 4,
  },
];

export const MASTER_ASPECT_GROUPS: SupervisionAspectGroup[] = groupIndicatorsByAspect(
  MASTER_PKKS_INDICATORS.map((ind, idx) => ({
    id: `ind_pkks_${idx + 1}`,
    instrumentId: 'inst_pkks_2026',
    ...ind,
    authorUid: 'master',
  }))
);
