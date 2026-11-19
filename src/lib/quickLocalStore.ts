import type { ActivityLog, SupervisionAssessment, SupervisionIndicator, SupervisionInstrument } from '../types/sims';
import {
  GURU_SUPERVISION_INDICATORS,
  GURU_SUPERVISION_INSTRUMENT,
  MASTER_PKKS_INDICATORS,
  MASTER_PKKS_INSTRUMENT,
  TENDIK_SUPERVISION_INDICATORS,
  TENDIK_SUPERVISION_INSTRUMENT,
} from './supervisionMasterData';

export const QUICK_KEYS = {
  STUDENTS: 'sims_quick_students',
  TEACHERS: 'sims_quick_teachers',
  CLASSES: 'sims_quick_classes',
  SUBJECTS: 'sims_quick_subjects',
  ACADEMIC_YEARS: 'sims_quick_academic_years',
  GRADES: 'sims_quick_grades',
  ATTENDANCE: 'sims_quick_attendance',
  ATTENDANCE_NOTIFICATIONS: 'sims_quick_attendance_notifications',
  ARCHIVE_FOLDERS: 'sims_quick_archive_folders',
  DIGITAL_ARCHIVES: 'sims_quick_digital_archives',
  SUPERVISION_INSTRUMENTS: 'sims_quick_supervision_instruments',
  SUPERVISION_INDICATORS: 'sims_quick_supervision_indicators',
  SUPERVISION_SCHEDULES: 'sims_quick_supervision_schedules',
  SUPERVISION_ASSESSMENTS: 'sims_quick_supervision_assessments',
  ACTIVITY_LOGS: 'sims_quick_activity_logs',
  SCHOOL_CONTENT: 'sims_quick_school_content',
  NEWS: 'sims_quick_news',
  ANNOUNCEMENTS: 'sims_quick_announcements',
  EVENTS: 'sims_quick_academic_events',
  ACHIEVEMENTS: 'sims_quick_achievements',
  GALLERY: 'sims_quick_gallery_items',
  DIRECTORY: 'sims_quick_public_directory',
} as const;

export function loadQuickData<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return structuredClone(fallback);
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
  } catch {
    // Fallback cleanly if localStorage is unavailable or malformed
  }
  return structuredClone(fallback);
}

export function saveQuickData<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadQuickRecord<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return structuredClone(fallback);
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as T;
    }
  } catch {
    // Fallback cleanly
  }
  return structuredClone(fallback);
}

export function saveQuickRecord<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function nextQuickId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const DEFAULT_QUICK_INSTRUMENTS: SupervisionInstrument[] = [
  { id: 'inst_pkks_2026', ...MASTER_PKKS_INSTRUMENT, authorUid: 'system' },
  { id: 'inst_guru_2026', ...GURU_SUPERVISION_INSTRUMENT, authorUid: 'system' },
  { id: 'inst_tendik_2026', ...TENDIK_SUPERVISION_INSTRUMENT, authorUid: 'system' },
];

export const DEFAULT_QUICK_INDICATORS: SupervisionIndicator[] = [
  ...MASTER_PKKS_INDICATORS.map((ind, idx) => ({
    id: `ind_pkks_${idx + 1}`,
    instrumentId: 'inst_pkks_2026',
    ...ind,
    authorUid: 'system',
  })),
  ...GURU_SUPERVISION_INDICATORS.map((ind, idx) => ({
    id: `ind_guru_${idx + 1}`,
    instrumentId: 'inst_guru_2026',
    ...ind,
    authorUid: 'system',
  })),
  ...TENDIK_SUPERVISION_INDICATORS.map((ind, idx) => ({
    id: `ind_tendik_${idx + 1}`,
    instrumentId: 'inst_tendik_2026',
    ...ind,
    authorUid: 'system',
  })),
];

export const DEFAULT_QUICK_SUPERVISION_ASSESSMENTS: SupervisionAssessment[] = [
  {
    id: 'asm_seed_1',
    scheduleId: 'sch_seed_1',
    instrumentId: 'inst_pkks_2026',
    instrumentTitle: MASTER_PKKS_INSTRUMENT.title,
    schoolName: 'SMA Darul Ulum Kepohbaru',
    assessedPersonName: 'Drs. H. Abdul Aziz, M.Pd.',
    assessedPersonRole: 'Kepala Sekolah',
    assessedPersonEmail: 'kepsek@smadukepohbaru.sch.id',
    supervisorName: 'Pengawas Pembina & Tim Penjaminan Mutu',
    academicYearName: '2026/2027',
    period: 'Semester Ganjil 2026',
    itemScores: {
      ind_pkks_1: { scale: 4, score: 4, note: 'SK Tim Penjamin Mutu dan dokumen Visi-Misi tersedia lengkap.' },
      ind_pkks_2: { scale: 4, score: 4, note: 'Sosialisasi terdokumentasi di portal publik dan berita acara.' },
      ind_pkks_3: { scale: 3, score: 3, note: 'Rencana kerja tahunan berjalan sesuai target Rapor Pendidikan.' },
    },
    sheetNotes: {
      utama: 'Penilaian pendahuluan aspek manajerial berjalan baik; lanjutkan kelengkapan bukti fisik tiap butir.',
    },
    overallScore: 11,
    overallMaxScore: MASTER_PKKS_INDICATORS.length * 4,
    overallPercentage: Number(((11 / (MASTER_PKKS_INDICATORS.length * 4)) * 100).toFixed(2)),
    overallPredicate: 'Sangat Kurang',
    unfilledCount: Math.max(0, MASTER_PKKS_INDICATORS.length - 3),
    recommendations: 'Lengkapi unggahan bukti fisik pada folder Manajerial & Kewirausahaan.',
    followUpPlan: 'Finalisasi verifikasi instrumen bersama tim penjaminan mutu sekolah.',
    followUpDeadline: '2026-12-05',
    status: 'Draft',
    authorUid: 'system',
  },
];

export const DEFAULT_QUICK_ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: 'log_seed_1',
    actorUid: 'qa_super_admin',
    actorName: 'Muhajir, S.Pd., M.Pd.',
    actorRole: 'super_admin',
    action: 'Inisialisasi Data Master',
    module: 'Sistem Inti',
    details: 'Menyiapkan data master SMA Darul Ulum Kepohbaru, 16 folder arsip, dan 88 butir instrumen supervisi.',
  },
  {
    id: 'log_seed_2',
    actorUid: 'qa_guru',
    actorName: 'Siti Aminah, S.Pd.',
    actorRole: 'guru',
    action: 'Catat Absensi Kelas',
    module: 'Absensi Online',
    details: 'Menyimpan presensi XI IPA 1 dan mengirim notifikasi ke akun orang tua.',
  },
  {
    id: 'log_seed_3',
    actorUid: 'qa_tendik',
    actorName: 'Nurul Hidayah, S.E.',
    actorRole: 'tendik',
    action: 'Unggah Dokumen Arsip',
    module: 'Arsip Digital',
    details: 'Mengunggah SK Visi, Misi & Tim Penjaminan Mutu SMA Darul Ulum 2026.',
  },
];

export function appendQuickActivityLog(entry: {
  actorUid?: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  details: string;
}): void {
  const current = loadQuickData<ActivityLog>(QUICK_KEYS.ACTIVITY_LOGS, DEFAULT_QUICK_ACTIVITY_LOGS);
  const next: ActivityLog = {
    id: nextQuickId('log'),
    actorUid: entry.actorUid || 'quick_session',
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    module: entry.module,
    details: entry.details,
  };
  saveQuickData(QUICK_KEYS.ACTIVITY_LOGS, [next, ...current].slice(0, 100));
}
