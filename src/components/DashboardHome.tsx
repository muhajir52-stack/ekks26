import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Archive,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  Database,
  GraduationCap,
  Users,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { seedInitialDatabase } from '../lib/seedData';
import type {
  ActivityLog,
  Announcement,
  AttendanceRecord,
  DashboardSection,
  DigitalArchive,
  GradeRecord,
  SchoolClass,
  Student,
  SupervisionAssessment,
  SupervisionSchedule,
  TeacherStaff,
} from '../types/sims';
import { ROLE_LABELS } from '../types/sims';
import { ParentPortalView } from './ParentPortalView';

interface DashboardHomeProps {
  onNavigate: (section: DashboardSection) => void;
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const { userAccount, effectiveRole } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<TeacherStaff[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [archives, setArchives] = useState<DigitalArchive[]>([]);
  const [schedules, setSchedules] = useState<SupervisionSchedule[]>([]);
  const [assessments, setAssessments] = useState<SupervisionAssessment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveRole === 'orang_tua') return;

    const unsubs = [
      onSnapshot(collection(db, 'students'), (s) =>
        setStudents(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) })))
      , () => {}),
      onSnapshot(collection(db, 'teachers'), (s) =>
        setTeachers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeacherStaff, 'id'>) })))
      , () => {}),
      onSnapshot(collection(db, 'classes'), (s) =>
        setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
      , () => {}),
      onSnapshot(collection(db, 'grades'), (s) =>
        setGrades(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GradeRecord, 'id'>) })))
      , () => {}),
      onSnapshot(collection(db, 'attendance'), (s) =>
        setAttendance(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) })))
      , () => {}),
      onSnapshot(collection(db, 'digital_archives'), (s) =>
        setArchives(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DigitalArchive, 'id'>) })))
      , () => {}),
      onSnapshot(collection(db, 'supervision_schedules'), (s) =>
        setSchedules(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupervisionSchedule, 'id'>) }))
        )
      , () => {}),
      onSnapshot(collection(db, 'supervision_assessments'), (s) =>
        setAssessments(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupervisionAssessment, 'id'>) }))
        )
      , () => {}),
      onSnapshot(collection(db, 'announcements'), (s) =>
        setAnnouncements(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
            .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
        )
      , () => {}),
      onSnapshot(collection(db, 'activity_logs'), (s) =>
        setLogs(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }))
            .slice(0, 8)
        )
      , () => {}),
    ];
    return () => unsubs.forEach((u) => u());
  }, [effectiveRole]);

  if (effectiveRole === 'orang_tua') {
    return <ParentPortalView />;
  }

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await seedInitialDatabase(userAccount?.displayName || 'Administrator');
      setSeedMessage(res.message);
    } catch (e) {
      setSeedMessage(e instanceof Error ? e.message : 'Gagal melakukan inisialisasi data.');
    } finally {
      setSeeding(false);
    }
  };

  const activeStudentsCount = students.filter((s) => s.status === 'aktif').length;
  const archiveStats = {
    Manajerial: archives.filter((a) => a.rootCategory === 'Manajerial').length,
    Kewirausahaan: archives.filter((a) => a.rootCategory === 'Kewirausahaan').length,
    'Supervisi Tendik': archives.filter((a) => a.rootCategory === 'Supervisi Tendik').length,
  };

  // Academic average per class for chart
  const classAverages = classes.map((c) => {
    const classGrades = grades.filter((g) => g.classId === c.id || g.className === c.name);
    const avg =
      classGrades.length > 0
        ? Math.round(classGrades.reduce((acc, g) => acc + g.finalScore, 0) / classGrades.length)
        : 0;
    return { name: c.name, avg, count: classGrades.length };
  });

  const canSeed =
    (userAccount?.role === 'super_admin' || effectiveRole === 'super_admin' || effectiveRole === 'kepala_sekolah') &&
    students.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-emerald-800">
            Dashboard {ROLE_LABELS[effectiveRole]} · SMA Darul Ulum Kepohbaru
          </div>
          <h1 className="text-2xl font-editorial font-semibold text-slate-950 mt-0.5">
            Selamat Datang, {userAccount?.displayName}
          </h1>
        </div>

        {(canSeed || seedMessage) && (
          <div className="flex items-center gap-3">
            {canSeed && (
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 disabled:opacity-60"
              >
                <Database className="w-4 h-4" />
                {seeding ? 'Menginisialisasi Data...' : 'Inisialisasi Data Awal & 88 Butir Master'}
              </button>
            )}
            {seedMessage && (
              <span className="text-xs text-emerald-800 font-medium">{seedMessage}</span>
            )}
          </div>
        )}
      </div>

      {/* Role-Specific Top KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Siswa Aktif</span>
            <GraduationCap className="w-4 h-4 text-emerald-800" />
          </div>
          <div className="text-2xl font-tabular font-bold text-slate-950">{activeStudentsCount}</div>
          <div className="text-xs text-slate-600">Dari total {students.length} data siswa</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Guru & Tendik</span>
            <Users className="w-4 h-4 text-emerald-800" />
          </div>
          <div className="text-2xl font-tabular font-bold text-slate-950">{teachers.length}</div>
          <div className="text-xs text-slate-600">
            {teachers.filter((t) => t.staffType === 'guru').length} Guru ·{' '}
            {teachers.filter((t) => t.staffType === 'tendik').length} Tendik
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Rombongan Belajar</span>
            <BookOpen className="w-4 h-4 text-emerald-800" />
          </div>
          <div className="text-2xl font-tabular font-bold text-slate-950">{classes.length}</div>
          <div className="text-xs text-slate-600">Tahun Pelajaran 2026/2027</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {effectiveRole === 'supervisor'
                ? 'Jadwal Supervisi'
                : effectiveRole === 'guru' || effectiveRole === 'wali_kelas'
                ? 'Catatan Absensi'
                : 'Arsip & Supervisi'}
            </span>
            {effectiveRole === 'guru' || effectiveRole === 'wali_kelas' ? (
              <CalendarCheck className="w-4 h-4 text-emerald-800" />
            ) : (
              <ClipboardCheck className="w-4 h-4 text-emerald-800" />
            )}
          </div>
          <div className="text-2xl font-tabular font-bold text-slate-950">
            {effectiveRole === 'guru' || effectiveRole === 'wali_kelas'
              ? attendance.length
              : `${archives.length} / ${assessments.length}`}
          </div>
          <div className="text-xs text-slate-600">
            {effectiveRole === 'guru' || effectiveRole === 'wali_kelas'
              ? 'Total sesi presensi terekam'
              : `${schedules.length} jadwal supervisi aktif`}
          </div>
        </div>
      </div>

      {/* Role-Adaptive Main Content Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Chart: Academic Progress & Supervision Overview */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {effectiveRole === 'supervisor'
                  ? 'Rekapitulasi Skor Supervisi'
                  : 'Grafik Perkembangan Akademik per Rombel'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {effectiveRole === 'supervisor'
                  ? 'Capaian nilai persentase instrumen supervisi tercatat'
                  : 'Rata-rata nilai akhir siswa berdasarkan rombongan belajar aktif'}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate(effectiveRole === 'supervisor' ? 'supervision' : 'academic')
              }
              className="text-xs font-semibold text-emerald-800 hover:underline"
            >
              Buka Modul
            </button>
          </div>

          {effectiveRole === 'supervisor' ? (
            <div className="space-y-3">
              {assessments.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Belum ada penilaian supervisi. Mulai penilaian di modul Supervisi Digital.
                </p>
              ) : (
                assessments.slice(0, 5).map((a) => (
                  <div key={a.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800">{a.assessedPersonName}</span>
                      <span className="font-tabular font-semibold text-emerald-900">
                        {a.overallPercentage.toFixed(1)}% ({a.overallPredicate})
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-700 rounded-full"
                        style={{ width: `${Math.min(100, a.overallPercentage)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {classAverages.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Data kelas & nilai akan tampil setelah data akademik diinisialisasi.
                </p>
              ) : (
                classAverages.map((c) => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        Kelas {c.name} ({c.count} data nilai)
                      </span>
                      <span className="font-tabular font-semibold text-emerald-900">
                        Rata-rata {c.avg}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-700 rounded-full"
                        style={{ width: `${Math.min(100, c.avg)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Statistik Dokumen Arsip */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5 text-emerald-800" /> Statistik Dokumen Arsip Digital
              </div>
              <button
                type="button"
                onClick={() => onNavigate('archives')}
                className="text-xs text-emerald-800 hover:underline font-medium"
              >
                Kelola Arsip
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(archiveStats).map(([cat, cnt]) => (
                <div key={cat} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500 truncate">{cat}</div>
                  <div className="text-lg font-tabular font-bold text-slate-900 mt-0.5">{cnt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Announcements + Recent Audit Activity */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">Pengumuman Terbaru</h2>
              {(effectiveRole === 'super_admin' || effectiveRole === 'tendik') && (
                <button
                  type="button"
                  onClick={() => onNavigate('cms')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Kelola
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-200">
              {announcements.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada pengumuman.</p>
              ) : (
                announcements.slice(0, 3).map((a) => (
                  <div key={a.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="text-xs text-slate-500 font-tabular">
                      {a.publishedDate} · {a.audience}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">Aktivitas Administrasi</h2>
              {(effectiveRole === 'super_admin' || effectiveRole === 'kepala_sekolah') && (
                <button
                  type="button"
                  onClick={() => onNavigate('users_audit')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Audit Log
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-200">
              {logs.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada aktivitas tercatat.</p>
              ) : (
                logs.slice(0, 4).map((l) => (
                  <div key={l.id} className="py-2.5 first:pt-0 last:pb-0 space-y-0.5">
                    <div className="text-xs font-semibold text-slate-800">
                      {l.action} · {l.module}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-1">
                      {l.actorName} — {l.details}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Bar for Teachers / Homeroom / Supervisors */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-700">
          Akses cepat modul operasional sesuai kewenangan peran{' '}
          <span className="font-semibold text-emerald-900">{ROLE_LABELS[effectiveRole]}</span>:
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('academic')}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg"
          >
            Data Akademik & Nilai
          </button>
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg"
          >
            Absensi Online
          </button>
          <button
            type="button"
            onClick={() => onNavigate('archives')}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg"
          >
            Arsip Digital
          </button>
          <button
            type="button"
            onClick={() => onNavigate('supervision')}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg"
          >
            Supervisi Digital
          </button>
        </div>
      </div>
    </div>
  );
}
