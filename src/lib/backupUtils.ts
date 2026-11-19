import { collection, getDocs } from 'firebase/firestore';
import { QUICK_ACCOUNTS } from '../context/AuthContext';
import { db } from './firebase';
import {
  DEFAULT_QUICK_ACTIVITY_LOGS,
  DEFAULT_QUICK_INDICATORS,
  DEFAULT_QUICK_INSTRUMENTS,
  DEFAULT_QUICK_SUPERVISION_ASSESSMENTS,
  DEFAULT_QUICK_SUPERVISION_OFFICERS,
  loadQuickData,
  loadQuickRecord,
  QUICK_KEYS,
} from './quickLocalStore';
import {
  DEFAULT_ACADEMIC_YEARS,
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_ANNOUNCEMENTS,
  DEFAULT_ARCHIVE_FOLDERS,
  DEFAULT_ATTENDANCE,
  DEFAULT_ATTENDANCE_NOTIFICATIONS,
  DEFAULT_CLASSES,
  DEFAULT_DIGITAL_ARCHIVES,
  DEFAULT_EVENTS,
  DEFAULT_GALLERY,
  DEFAULT_GRADES,
  DEFAULT_NEWS,
  DEFAULT_PUBLIC_DIRECTORY,
  DEFAULT_PUBLIC_PROFILE,
  DEFAULT_STUDENTS,
  DEFAULT_SUBJECTS,
  DEFAULT_SUPERVISION_SCHEDULES,
  DEFAULT_TEACHERS,
} from './seedData';
import type {
  AcademicEvent,
  AcademicYear,
  Achievement,
  ActivityLog,
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
  SupervisionAssessment,
  SupervisionIndicator,
  SupervisionInstrument,
  SupervisionOfficer,
  SupervisionSchedule,
  TeacherStaff,
  UserAccount,
} from '../types/sims';

export interface DailyBackupHistoryEntry {
  id: string;
  date: string;
  timestamp: string;
  fileName: string;
  totalRecords: number;
  sizeBytes: number;
  sourceMode: 'Cloud Firestore' | 'Sesi Akun Langsung (Lokal)';
  actorName: string;
  includeEmbeddedFiles: boolean;
}

export interface FullSystemBackupPayload {
  metadata: {
    systemName: string;
    institution: string;
    location: string;
    backupType: 'Backup Database Harian';
    schemaVersion: string;
    exportedAt: string;
    exportedDate: string;
    exportedBy: string;
    sourceMode: 'Cloud Firestore' | 'Sesi Akun Langsung (Lokal)';
    includeEmbeddedFiles: boolean;
    totalRecords: number;
    collectionCounts: Record<string, number>;
  };
  collections: Record<string, Array<Record<string, unknown>>>;
}

export const DAILY_BACKUP_HISTORY_KEY = 'sims_daily_backup_history';

export const BACKUP_COLLECTION_GROUPS = [
  {
    group: 'Akademik & Data Induk',
    keys: [
      { key: 'academic_years', label: 'Tahun Pelajaran' },
      { key: 'classes', label: 'Rombongan Belajar' },
      { key: 'subjects', label: 'Mata Pelajaran' },
      { key: 'teachers', label: 'Guru & Tendik' },
      { key: 'students', label: 'Master Siswa' },
      { key: 'grades', label: 'Nilai & Rekap' },
    ],
  },
  {
    group: 'Absensi & Notifikasi',
    keys: [
      { key: 'attendance', label: 'Rekam Absensi' },
      { key: 'attendance_notifications', label: 'Notifikasi Orang Tua' },
    ],
  },
  {
    group: 'Arsip Digital Sekolah',
    keys: [
      { key: 'archive_folders', label: 'Direktori Arsip' },
      { key: 'digital_archives', label: 'Dokumen Arsip' },
    ],
  },
  {
    group: 'Supervisi Digital',
    keys: [
      { key: 'supervision_instruments', label: 'Instrumen Supervisi' },
      { key: 'supervision_indicators', label: 'Butir Indikator' },
      { key: 'supervision_schedules', label: 'Jadwal Supervisi' },
      { key: 'supervision_assessments', label: 'Hasil Penilaian' },
      { key: 'supervision_officers', label: 'Petugas Supervisor' },
    ],
  },
  {
    group: 'Website Profil & CMS',
    keys: [
      { key: 'school_content', label: 'Profil & Pengaturan Visual' },
      { key: 'news', label: 'Berita Sekolah' },
      { key: 'announcements', label: 'Pengumuman' },
      { key: 'academic_events', label: 'Kalender Akademik' },
      { key: 'achievements', label: 'Prestasi' },
      { key: 'gallery_items', label: 'Galeri Media' },
      { key: 'public_directory', label: 'Direktori GTK Publik' },
    ],
  },
  {
    group: 'Pengguna & Audit Sistem',
    keys: [
      { key: 'users', label: 'Akun Pengguna' },
      { key: 'activity_logs', label: 'Log Aktivitas' },
    ],
  },
] as const;

function serializeValue(val: unknown, includeEmbeddedFiles: boolean): unknown {
  if (val === null || val === undefined) return val;
  if (
    typeof val === 'object' &&
    'toDate' in val &&
    typeof (val as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Array.isArray(val)) {
    return val.map((item) => serializeValue(item, includeEmbeddedFiles));
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (
        !includeEmbeddedFiles &&
        (k === 'contentDataUrl' || k === 'imageUrl' || k === 'mediaUrl') &&
        typeof v === 'string' &&
        v.startsWith('data:')
      ) {
        out[k] = `[disembunyikan_untuk_ukuran_ringkas:${v.length}_chars]`;
      } else {
        out[k] = serializeValue(v, includeEmbeddedFiles);
      }
    }
    return out;
  }
  return val;
}

export function loadDailyBackupHistory(): DailyBackupHistoryEntry[] {
  return loadQuickData<DailyBackupHistoryEntry>(DAILY_BACKUP_HISTORY_KEY, []);
}

export function recordDailyBackupHistory(entry: DailyBackupHistoryEntry): DailyBackupHistoryEntry[] {
  const current = loadDailyBackupHistory();
  const next = [entry, ...current].slice(0, 30);
  try {
    localStorage.setItem(DAILY_BACKUP_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues gracefully
  }
  return next;
}

export async function generateFullSystemBackup(options: {
  isQuickSession: boolean;
  actorName: string;
  actorEmail: string;
  includeEmbeddedFiles?: boolean;
}): Promise<FullSystemBackupPayload> {
  const includeEmbeddedFiles = options.includeEmbeddedFiles ?? true;
  const now = new Date();
  const exportedDate = now.toISOString().slice(0, 10);
  const collections: Record<string, Array<Record<string, unknown>>> = {};

  if (options.isQuickSession) {
    const localContentRecord = loadQuickRecord<Record<string, SchoolContent>>(
      QUICK_KEYS.SCHOOL_CONTENT,
      {}
    );
    const mergedContentMap: Record<string, SchoolContent> = {};
    Object.entries(DEFAULT_PUBLIC_PROFILE).forEach(([k, val]) => {
      mergedContentMap[k] = { id: k, ...val, updatedByUid: 'system' };
    });
    Object.entries(localContentRecord).forEach(([k, val]) => {
      mergedContentMap[k] = val;
    });

    const defaultQuickUsers: UserAccount[] = QUICK_ACCOUNTS.map((q) => ({
      id: q.id,
      uid: q.uid,
      email: q.email,
      displayName: q.displayName,
      role: q.role,
      activeStatus: 'aktif',
    }));

    const rawCollections: Record<string, unknown[]> = {
      school_content: Object.values(mergedContentMap),
      news: loadQuickData<NewsArticle>(
        QUICK_KEYS.NEWS,
        DEFAULT_NEWS.map((n, i) => ({ ...n, id: `def_n_${i}`, authorUid: 'system' }))
      ),
      announcements: loadQuickData<Announcement>(
        QUICK_KEYS.ANNOUNCEMENTS,
        DEFAULT_ANNOUNCEMENTS.map((a, i) => ({ ...a, id: `def_a_${i}`, authorUid: 'system' }))
      ),
      academic_events: loadQuickData<AcademicEvent>(
        QUICK_KEYS.EVENTS,
        DEFAULT_EVENTS.map((ev, i) => ({ ...ev, id: `def_e_${i}`, authorUid: 'system' }))
      ),
      achievements: loadQuickData<Achievement>(
        QUICK_KEYS.ACHIEVEMENTS,
        DEFAULT_ACHIEVEMENTS.map((ac, i) => ({ ...ac, id: `def_ac_${i}`, authorUid: 'system' }))
      ),
      gallery_items: loadQuickData<GalleryItem>(
        QUICK_KEYS.GALLERY,
        DEFAULT_GALLERY.map((g, i) => ({ ...g, id: `def_g_${i}`, authorUid: 'system' }))
      ),
      public_directory: loadQuickData<PublicDirectoryEntry>(
        QUICK_KEYS.DIRECTORY,
        DEFAULT_PUBLIC_DIRECTORY.map((d, i) => ({ ...d, id: `def_d_${i}`, authorUid: 'system' }))
      ),
      academic_years: loadQuickData<AcademicYear>(QUICK_KEYS.ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEARS),
      classes: loadQuickData<SchoolClass>(QUICK_KEYS.CLASSES, DEFAULT_CLASSES),
      subjects: loadQuickData<Subject>(QUICK_KEYS.SUBJECTS, DEFAULT_SUBJECTS),
      teachers: loadQuickData<TeacherStaff>(QUICK_KEYS.TEACHERS, DEFAULT_TEACHERS),
      students: loadQuickData<Student>(QUICK_KEYS.STUDENTS, DEFAULT_STUDENTS),
      grades: loadQuickData<GradeRecord>(QUICK_KEYS.GRADES, DEFAULT_GRADES),
      attendance: loadQuickData<AttendanceRecord>(QUICK_KEYS.ATTENDANCE, DEFAULT_ATTENDANCE),
      attendance_notifications: loadQuickData<AttendanceNotification>(
        QUICK_KEYS.ATTENDANCE_NOTIFICATIONS,
        DEFAULT_ATTENDANCE_NOTIFICATIONS
      ),
      archive_folders: loadQuickData<ArchiveFolder>(QUICK_KEYS.ARCHIVE_FOLDERS, DEFAULT_ARCHIVE_FOLDERS),
      digital_archives: loadQuickData<DigitalArchive>(
        QUICK_KEYS.DIGITAL_ARCHIVES,
        DEFAULT_DIGITAL_ARCHIVES
      ),
      supervision_instruments: loadQuickData<SupervisionInstrument>(
        QUICK_KEYS.SUPERVISION_INSTRUMENTS,
        DEFAULT_QUICK_INSTRUMENTS
      ),
      supervision_indicators: loadQuickData<SupervisionIndicator>(
        QUICK_KEYS.SUPERVISION_INDICATORS,
        DEFAULT_QUICK_INDICATORS
      ),
      supervision_schedules: loadQuickData<SupervisionSchedule>(
        QUICK_KEYS.SUPERVISION_SCHEDULES,
        DEFAULT_SUPERVISION_SCHEDULES
      ),
      supervision_assessments: loadQuickData<SupervisionAssessment>(
        QUICK_KEYS.SUPERVISION_ASSESSMENTS,
        DEFAULT_QUICK_SUPERVISION_ASSESSMENTS
      ),
      supervision_officers: loadQuickData<SupervisionOfficer>(
        QUICK_KEYS.SUPERVISION_OFFICERS,
        DEFAULT_QUICK_SUPERVISION_OFFICERS
      ),
      users: loadQuickData<UserAccount>('sims_quick_users', defaultQuickUsers),
      activity_logs: loadQuickData<ActivityLog>(QUICK_KEYS.ACTIVITY_LOGS, DEFAULT_QUICK_ACTIVITY_LOGS),
    };

    for (const [colName, arr] of Object.entries(rawCollections)) {
      collections[colName] = arr.map((item) =>
        serializeValue(item, includeEmbeddedFiles) as Record<string, unknown>
      );
    }
  } else {
    const allKeys = BACKUP_COLLECTION_GROUPS.flatMap((g) => g.keys.map((k) => k.key));
    const snapshots = await Promise.all(
      allKeys.map(async (colName) => {
        const snap = await getDocs(collection(db, colName));
        const docs = snap.docs.map(
          (d) =>
            serializeValue({ id: d.id, ...d.data() }, includeEmbeddedFiles) as Record<
              string,
              unknown
            >
        );
        return [colName, docs] as const;
      })
    );
    for (const [colName, docs] of snapshots) {
      collections[colName] = docs;
    }
  }

  const collectionCounts: Record<string, number> = {};
  let totalRecords = 0;
  for (const [colName, docs] of Object.entries(collections)) {
    collectionCounts[colName] = docs.length;
    totalRecords += docs.length;
  }

  return {
    metadata: {
      systemName: 'Sistem Informasi Manajemen Sekolah (SIMS)',
      institution: 'SMA Darul Ulum Kepohbaru',
      location: 'Kepohbaru, Bojonegoro, Jawa Timur',
      backupType: 'Backup Database Harian',
      schemaVersion: '1.0',
      exportedAt: now.toISOString(),
      exportedDate,
      exportedBy: `${options.actorName} (${options.actorEmail})`,
      sourceMode: options.isQuickSession ? 'Sesi Akun Langsung (Lokal)' : 'Cloud Firestore',
      includeEmbeddedFiles,
      totalRecords,
      collectionCounts,
    },
    collections,
  };
}

export function triggerJsonBackupDownload(payload: FullSystemBackupPayload): {
  fileName: string;
  sizeBytes: number;
} {
  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const fileName = `Backup_Harian_SIMS_SMADU_${payload.metadata.exportedDate}.json`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { fileName, sizeBytes: blob.size };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
