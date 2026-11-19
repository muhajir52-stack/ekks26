import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Bell, BookOpen, CalendarCheck, Check, UserCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_ANNOUNCEMENTS,
  DEFAULT_ATTENDANCE,
  DEFAULT_ATTENDANCE_NOTIFICATIONS,
  DEFAULT_GRADES,
  DEFAULT_STUDENTS,
} from '../lib/seedData';
import { loadQuickData, QUICK_KEYS, saveQuickData } from '../lib/quickLocalStore';
import type {
  Announcement,
  AttendanceNotification,
  AttendanceRecord,
  GradeRecord,
  Student,
} from '../types/sims';

export function ParentPortalView() {
  const { userAccount, effectiveRole, isQuickSession } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const parentEmail = userAccount?.email || '';
  const isPreviewMode = userAccount?.role === 'super_admin' && effectiveRole === 'orang_tua';

  useEffect(() => {
    if (!parentEmail) return;

    if (isQuickSession) {
      const allStudents = loadQuickData(QUICK_KEYS.STUDENTS, DEFAULT_STUDENTS);
      const filteredStudents = isPreviewMode
        ? allStudents
        : allStudents.filter(
            (s) => (s.parentEmail || '').toLowerCase() === parentEmail.toLowerCase()
          );
      setStudents(filteredStudents);
      if (filteredStudents.length > 0 && !selectedStudentId) {
        setSelectedStudentId(filteredStudents[0].id);
      }

      const allGrades = loadQuickData(QUICK_KEYS.GRADES, DEFAULT_GRADES);
      setGrades(
        isPreviewMode
          ? allGrades
          : allGrades.filter(
              (g) => (g.parentEmail || '').toLowerCase() === parentEmail.toLowerCase()
            )
      );

      const allAtt = loadQuickData(QUICK_KEYS.ATTENDANCE, DEFAULT_ATTENDANCE);
      setAttendance(
        (isPreviewMode
          ? allAtt
          : allAtt.filter(
              (a) => (a.parentEmail || '').toLowerCase() === parentEmail.toLowerCase()
            )
        ).sort((a, b) => b.date.localeCompare(a.date))
      );

      const allNotif = loadQuickData(
        QUICK_KEYS.ATTENDANCE_NOTIFICATIONS,
        DEFAULT_ATTENDANCE_NOTIFICATIONS
      );
      setNotifications(
        (isPreviewMode
          ? allNotif
          : allNotif.filter(
              (n) => (n.parentEmail || '').toLowerCase() === parentEmail.toLowerCase()
            )
        ).sort((a, b) => b.date.localeCompare(a.date))
      );

      const defAnn: Announcement[] = DEFAULT_ANNOUNCEMENTS.map((a, i) => ({
        ...a,
        id: `ann_seed_${i + 1}`,
        authorUid: 'system',
      }));
      setAnnouncements(
        loadQuickData(QUICK_KEYS.ANNOUNCEMENTS, defAnn)
          .filter((a) => a.audience === 'orang_tua' || a.audience === 'publik' || a.audience === 'semua')
          .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
      );
      return;
    }

    const studentQ = isPreviewMode
      ? collection(db, 'students')
      : query(collection(db, 'students'), where('parentEmail', '==', parentEmail));

    const gradeQ = isPreviewMode
      ? collection(db, 'grades')
      : query(collection(db, 'grades'), where('parentEmail', '==', parentEmail));

    const attQ = isPreviewMode
      ? collection(db, 'attendance')
      : query(collection(db, 'attendance'), where('parentEmail', '==', parentEmail));

    const notifQ = isPreviewMode
      ? collection(db, 'attendance_notifications')
      : query(collection(db, 'attendance_notifications'), where('parentEmail', '==', parentEmail));

    const unsubs = [
      onSnapshot(
        studentQ,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }));
          setStudents(list);
          if (list.length > 0 && !selectedStudentId) setSelectedStudentId(list[0].id);
        },
        (e) => handleFirestoreError(e, OperationType.LIST, 'students')
      ),
      onSnapshot(
        gradeQ,
        (snap) => {
          setGrades(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GradeRecord, 'id'>) })));
        },
        (e) => handleFirestoreError(e, OperationType.LIST, 'grades')
      ),
      onSnapshot(
        attQ,
        (snap) => {
          setAttendance(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
              .sort((a, b) => b.date.localeCompare(a.date))
          );
        },
        (e) => handleFirestoreError(e, OperationType.LIST, 'attendance')
      ),
      onSnapshot(
        notifQ,
        (snap) => {
          setNotifications(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceNotification, 'id'>) }))
              .sort((a, b) => b.date.localeCompare(a.date))
          );
        },
        (e) => handleFirestoreError(e, OperationType.LIST, 'attendance_notifications')
      ),
      onSnapshot(
        collection(db, 'announcements'),
        (snap) => {
          setAnnouncements(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
              .filter((a) => a.audience === 'orang_tua' || a.audience === 'publik' || a.audience === 'semua')
              .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
          );
        },
        (e) => handleFirestoreError(e, OperationType.LIST, 'announcements')
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [parentEmail, isPreviewMode, isQuickSession, selectedStudentId]);

  const activeStudent = students.find((s) => s.id === selectedStudentId) || students[0];
  const studentGrades = activeStudent
    ? grades.filter((g) => g.studentId === activeStudent.id)
    : [];
  const studentAttendance = activeStudent
    ? attendance.filter((a) => a.studentId === activeStudent.id)
    : [];
  const unreadNotifs = notifications.filter((n) => !n.isRead);

  const handleMarkRead = async (notifId: string) => {
    if (isQuickSession) {
      const allNotif = loadQuickData(
        QUICK_KEYS.ATTENDANCE_NOTIFICATIONS,
        DEFAULT_ATTENDANCE_NOTIFICATIONS
      ).map((n) => (n.id === notifId ? { ...n, isRead: true } : n));
      saveQuickData(QUICK_KEYS.ATTENDANCE_NOTIFICATIONS, allNotif);
      setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n)));
      return;
    }

    try {
      await updateDoc(doc(db, 'attendance_notifications', notifId), {
        isRead: true,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `attendance_notifications/${notifId}`);
    }
  };

  const avgGrade =
    studentGrades.length > 0
      ? (studentGrades.reduce((acc, g) => acc + g.finalScore, 0) / studentGrades.length).toFixed(1)
      : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-editorial font-semibold text-slate-950">
            Portal Orang Tua / Wali Siswa
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pemantauan kehadiran harian, notifikasi sekolah, dan perkembangan akademik putra-putri Anda.
          </p>
        </div>
        {students.length > 1 && (
          <select
            value={activeStudent?.id || ''}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-medium"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.className})
              </option>
            ))}
          </select>
        )}
      </div>

      {!activeStudent ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <div className="text-base font-semibold text-slate-900">
            Belum Ada Data Siswa Tertaut ke Email {parentEmail}
          </div>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Silakan hubungi Staf Tata Usaha SMA Darul Ulum Kepohbaru agar email akun Google Anda
            ditautkan pada data master siswa sebagai Email Orang Tua.
          </p>
        </div>
      ) : (
        <>
          {/* Ringkasan Profil Anak */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Profil Peserta Didik</span>
                <UserCheck className="w-4 h-4 text-emerald-800" />
              </div>
              <div className="text-base font-semibold text-slate-950">{activeStudent.name}</div>
              <div className="text-xs text-slate-600 font-tabular">
                NIS {activeStudent.nis} · Kelas {activeStudent.className}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Rata-Rata Nilai</span>
                <BookOpen className="w-4 h-4 text-emerald-800" />
              </div>
              <div className="text-2xl font-tabular font-bold text-emerald-900">{avgGrade}</div>
              <div className="text-xs text-slate-600">
                {studentGrades.length} mata pelajaran ternilai
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Catatan Kehadiran</span>
                <CalendarCheck className="w-4 h-4 text-emerald-800" />
              </div>
              <div className="text-2xl font-tabular font-bold text-slate-900">
                {studentAttendance.filter((a) => a.status === 'Hadir').length} / {studentAttendance.length}
              </div>
              <div className="text-xs text-slate-600">Sesi hadir tercatat</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Notifikasi Belum Dibaca</span>
                <Bell className="w-4 h-4 text-amber-700" />
              </div>
              <div className="text-2xl font-tabular font-bold text-amber-700">
                {unreadNotifs.length}
              </div>
              <div className="text-xs text-slate-600">Pemberitahuan absensi terbaru</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Notifikasi Kehadiran */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-950">Notifikasi Kehadiran Anak</h2>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada notifikasi kehadiran.</p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {notifications.map((n) => (
                    <div key={n.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 font-tabular">
                          {n.date} · {n.status} · {n.isRead ? 'Sudah dibaca' : 'Baru'}
                        </div>
                        <p className="text-sm text-slate-800">{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg hover:bg-emerald-100 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" /> Tandai Dibaca
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pengumuman Sekolah */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-950">Pengumuman Sekolah</h2>
              <div className="divide-y divide-slate-200">
                {announcements.slice(0, 5).map((a) => (
                  <div key={a.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="text-xs text-slate-500 font-tabular">
                      {a.publishedDate} · {a.authorName}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                    <p className="text-xs text-slate-600">{a.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Perkembangan Akademik & Riwayat Absensi */}
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-950">Perkembangan Nilai Akademik</h2>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Mata Pelajaran</th>
                      <th className="py-2.5 px-3 font-semibold text-right">UH</th>
                      <th className="py-2.5 px-3 font-semibold text-right">UTS</th>
                      <th className="py-2.5 px-3 font-semibold text-right">UAS</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Akhir</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Pred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-tabular">
                    {studentGrades.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                          Belum ada nilai akademik tercatat.
                        </td>
                      </tr>
                    ) : (
                      studentGrades.map((g) => (
                        <tr key={g.id}>
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                            {g.subjectName}
                          </td>
                          <td className="py-2.5 px-3 text-right">{g.uhScore ?? '-'}</td>
                          <td className="py-2.5 px-3 text-right">{g.utsScore ?? '-'}</td>
                          <td className="py-2.5 px-3 text-right">{g.uasScore ?? '-'}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-900">
                            {g.finalScore}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold">{g.predicate}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-950">Riwayat Absensi Anak</h2>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {studentAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-500">
                          Belum ada riwayat absensi.
                        </td>
                      </tr>
                    ) : (
                      studentAttendance.map((a) => (
                        <tr key={a.id}>
                          <td className="py-2.5 px-3 font-tabular text-xs">{a.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-xs">
                            <span
                              className={
                                a.status === 'Hadir'
                                  ? 'text-emerald-700'
                                  : a.status === 'Alpa'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                              }
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-600">{a.note || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
