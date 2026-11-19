import { useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { BellRing, CheckCheck, FileSpreadsheet, FileText, Save } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/audit';
import {
  DEFAULT_ATTENDANCE,
  DEFAULT_ATTENDANCE_NOTIFICATIONS,
  DEFAULT_CLASSES,
  DEFAULT_STUDENTS,
  DEFAULT_SUBJECTS,
} from '../lib/seedData';
import {
  appendQuickActivityLog,
  loadQuickData,
  nextQuickId,
  QUICK_KEYS,
  saveQuickData,
} from '../lib/quickLocalStore';
import { exportAttendanceToExcel, exportAttendanceToPDF } from '../lib/exportUtils';
import type {
  AttendanceNotification,
  AttendanceRecord,
  AttendanceStatus,
  SchoolClass,
  Student,
  Subject,
} from '../types/sims';

type AttendanceTab = 'input' | 'recap' | 'notifications';

export function AttendanceModule() {
  const { userAccount, effectiveRole, isQuickSession } = useAuth();
  const [tab, setTab] = useState<AttendanceTab>('input');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Absensi Harian');
  const [notifyAll, setNotifyAll] = useState(false);

  const [draftStatuses, setDraftStatuses] = useState<
    Record<string, { status: AttendanceStatus; note: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canTakeAttendance = ['super_admin', 'kepala_sekolah', 'guru', 'wali_kelas'].includes(
    effectiveRole
  );

  useEffect(() => {
    if (isQuickSession) {
      const clsList = loadQuickData(QUICK_KEYS.CLASSES, DEFAULT_CLASSES);
      setClasses(clsList);
      if (clsList.length > 0 && !selectedClassId) setSelectedClassId(clsList[0].id);
      setSubjects(loadQuickData(QUICK_KEYS.SUBJECTS, DEFAULT_SUBJECTS));
      setStudents(
        loadQuickData(QUICK_KEYS.STUDENTS, DEFAULT_STUDENTS).filter((st) => st.status === 'aktif')
      );
      setRecords(
        loadQuickData(QUICK_KEYS.ATTENDANCE, DEFAULT_ATTENDANCE).sort((a, b) =>
          b.date.localeCompare(a.date)
        )
      );
      setNotifications(
        loadQuickData(
          QUICK_KEYS.ATTENDANCE_NOTIFICATIONS,
          DEFAULT_ATTENDANCE_NOTIFICATIONS
        ).sort((a, b) => b.date.localeCompare(a.date))
      );
      return;
    }

    const unsubs = [
      onSnapshot(collection(db, 'classes'), (s) => {
        const list = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) }));
        setClasses(list);
        if (list.length > 0 && !selectedClassId) setSelectedClassId(list[0].id);
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'classes')),
      onSnapshot(collection(db, 'subjects'), (s) =>
        setSubjects(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) })))
      , (e) => handleFirestoreError(e, OperationType.LIST, 'subjects')),
      onSnapshot(collection(db, 'students'), (s) =>
        setStudents(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
            .filter((st) => st.status === 'aktif')
        )
      , (e) => handleFirestoreError(e, OperationType.LIST, 'students')),
      onSnapshot(collection(db, 'attendance'), (s) =>
        setRecords(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
            .sort((a, b) => b.date.localeCompare(a.date))
        )
      , (e) => handleFirestoreError(e, OperationType.LIST, 'attendance')),
      onSnapshot(collection(db, 'attendance_notifications'), (s) =>
        setNotifications(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceNotification, 'id'>) }))
            .sort((a, b) => b.date.localeCompare(a.date))
        )
      , (e) => handleFirestoreError(e, OperationType.LIST, 'attendance_notifications')),
    ];
    return () => unsubs.forEach((u) => u());
  }, [selectedClassId, isQuickSession]);

  const classStudents = students.filter((s) => s.classId === selectedClassId);

  const markAllPresent = () => {
    const next: Record<string, { status: AttendanceStatus; note: string }> = {};
    for (const s of classStudents) {
      next[s.id] = { status: 'Hadir', note: draftStatuses[s.id]?.note || '' };
    }
    setDraftStatuses(next);
  };

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setDraftStatuses((prev) => ({
      ...prev,
      [studentId]: { status, note: prev[studentId]?.note || '' },
    }));
  };

  const setStudentNote = (studentId: string, note: string) => {
    setDraftStatuses((prev) => ({
      ...prev,
      [studentId]: { status: prev[studentId]?.status || 'Hadir', note },
    }));
  };

  const handleSaveBatch = async () => {
    if (!userAccount || classStudents.length === 0) return;
    setSaving(true);
    setFeedback(null);
    let savedCount = 0;
    let notifCount = 0;

    if (isQuickSession) {
      const newRecords: AttendanceRecord[] = [];
      const newNotifs: AttendanceNotification[] = [];
      for (const s of classStudents) {
        const entry = draftStatuses[s.id] || { status: 'Hadir' as AttendanceStatus, note: '' };
        newRecords.push({
          id: nextQuickId('att'),
          date: selectedDate,
          studentId: s.id,
          studentName: s.name,
          classId: s.classId,
          className: s.className,
          subjectName: selectedSubject,
          status: entry.status,
          note: entry.note,
          parentEmail: s.parentEmail || '',
          recordedByName: userAccount.displayName,
          authorUid: userAccount.uid,
        });
        savedCount += 1;

        if (s.parentEmail && (notifyAll || entry.status !== 'Hadir')) {
          newNotifs.push({
            id: nextQuickId('notif'),
            studentId: s.id,
            studentName: s.name,
            className: s.className,
            parentEmail: s.parentEmail,
            date: selectedDate,
            status: entry.status,
            message: `Ananda ${s.name} (${s.className}) tercatat berstatus ${entry.status.toUpperCase()} pada ${selectedDate} (${selectedSubject}).${
              entry.note ? ` Keterangan: ${entry.note}` : ''
            }`,
            isRead: false,
            authorUid: userAccount.uid,
          });
          notifCount += 1;
        }
      }

      const nextRecords = [...newRecords, ...records];
      const nextNotifs = [...newNotifs, ...notifications];
      setRecords(nextRecords);
      setNotifications(nextNotifs);
      saveQuickData(QUICK_KEYS.ATTENDANCE, nextRecords);
      saveQuickData(QUICK_KEYS.ATTENDANCE_NOTIFICATIONS, nextNotifs);

      appendQuickActivityLog({
        actorUid: userAccount.uid,
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Catat Absensi Kelas',
        module: 'Absensi Online',
        details: `Menyimpan ${savedCount} presensi kelas (${selectedDate}) dan mengirim ${notifCount} notifikasi orang tua.`,
      });
      setFeedback(
        `Berhasil menyimpan ${savedCount} presensi siswa dan mengirim ${notifCount} notifikasi ke akun orang tua.`
      );
      setSaving(false);
      return;
    }

    try {
      for (const s of classStudents) {
        const entry = draftStatuses[s.id] || { status: 'Hadir' as AttendanceStatus, note: '' };
        await addDoc(collection(db, 'attendance'), {
          date: selectedDate,
          studentId: s.id,
          studentName: s.name,
          classId: s.classId,
          className: s.className,
          subjectName: selectedSubject,
          status: entry.status,
          note: entry.note,
          parentEmail: s.parentEmail || '',
          recordedByName: userAccount.displayName,
          authorUid: userAccount.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        savedCount += 1;

        if (s.parentEmail && (notifyAll || entry.status !== 'Hadir')) {
          await addDoc(collection(db, 'attendance_notifications'), {
            studentId: s.id,
            studentName: s.name,
            className: s.className,
            parentEmail: s.parentEmail,
            date: selectedDate,
            status: entry.status,
            message: `Ananda ${s.name} (${s.className}) tercatat berstatus ${entry.status.toUpperCase()} pada ${selectedDate} (${selectedSubject}).${
              entry.note ? ` Keterangan: ${entry.note}` : ''
            }`,
            isRead: false,
            authorUid: userAccount.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          notifCount += 1;
        }
      }

      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Catat Absensi Kelas',
        module: 'Absensi Online',
        details: `Menyimpan ${savedCount} presensi kelas (${selectedDate}) dan mengirim ${notifCount} notifikasi orang tua.`,
      });

      setFeedback(
        `Berhasil menyimpan ${savedCount} presensi siswa dan mengirim ${notifCount} notifikasi ke akun orang tua.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-editorial font-semibold text-slate-950">
            Sistem Absensi Online & Notifikasi Orang Tua
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pencatatan kehadiran harian/mata pelajaran yang otomatis terhubung ke portal Orang Tua.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {[
            { key: 'input', label: 'Input Absensi' },
            { key: 'recap', label: 'Rekapitulasi' },
            { key: 'notifications', label: 'Notifikasi Terkirim' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as AttendanceTab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 ${
                tab === item.key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-xs font-medium text-emerald-900">
          {feedback}
        </div>
      )}

      {tab === 'input' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="grid sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rombongan Belajar</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sesi / Mata Pelajaran</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                <option value="Absensi Harian">Absensi Harian (Wali Kelas)</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAllPresent}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 w-full justify-center"
              >
                <CheckCheck className="w-4 h-4 text-emerald-700" /> Tandai Semua Hadir
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-600">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyAll}
                onChange={(e) => setNotifyAll(e.target.checked)}
                className="rounded border-slate-300 text-emerald-800"
              />
              <span>
                Kirim notifikasi ke orang tua untuk semua status (bawaan: otomatis dikirim untuk Izin, Sakit, Alpa)
              </span>
            </label>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">NIS</th>
                  <th className="py-2.5 px-3 font-semibold">Nama Siswa</th>
                  <th className="py-2.5 px-3 font-semibold">Status Kehadiran</th>
                  <th className="py-2.5 px-3 font-semibold">Catatan / Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {classStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Tidak ada siswa aktif di kelas ini.
                    </td>
                  </tr>
                ) : (
                  classStudents.map((s) => {
                    const current = draftStatuses[s.id]?.status || 'Hadir';
                    return (
                      <tr key={s.id}>
                        <td className="py-2.5 px-3 font-tabular text-xs">{s.nis}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{s.name}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => (
                              <button
                                key={st}
                                type="button"
                                disabled={!canTakeAttendance}
                                onClick={() => setStudentStatus(s.id, st)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
                                  current === st
                                    ? st === 'Hadir'
                                      ? 'bg-emerald-800 text-white border-emerald-800'
                                      : st === 'Alpa'
                                      ? 'bg-red-700 text-white border-red-700'
                                      : 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            disabled={!canTakeAttendance}
                            value={draftStatuses[s.id]?.note || ''}
                            onChange={(e) => setStudentNote(s.id, e.target.value)}
                            placeholder="Opsional..."
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {canTakeAttendance && classStudents.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveBatch}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Absensi & Kirim Notifikasi'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'recap' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">
              Rekapitulasi Kehadiran Siswa ({records.length} catatan)
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportAttendanceToExcel(records)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportAttendanceToPDF(records)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <FileText className="w-3.5 h-3.5 text-red-700" /> PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                  <th className="py-2.5 px-3 font-semibold">Nama Siswa</th>
                  <th className="py-2.5 px-3 font-semibold">Kelas</th>
                  <th className="py-2.5 px-3 font-semibold">Sesi</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Keterangan</th>
                  <th className="py-2.5 px-3 font-semibold">Pencatat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-tabular text-xs">{r.date}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{r.studentName}</td>
                    <td className="py-2.5 px-3 text-xs">{r.className}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-600">{r.subjectName || 'Harian'}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold">
                      <span
                        className={
                          r.status === 'Hadir'
                            ? 'text-emerald-700'
                            : r.status === 'Alpa'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600">{r.note || '-'}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-600">{r.recordedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-emerald-800" />
            <h2 className="text-base font-semibold text-slate-950">
              Riwayat Notifikasi Kehadiran ke Orang Tua
            </h2>
          </div>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Belum ada notifikasi terkirim.
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 font-tabular">
                      {n.date} · {n.studentName} ({n.className}) · Kepada: {n.parentEmail}
                    </div>
                    <div className="text-sm text-slate-800">{n.message}</div>
                  </div>
                  <div className="text-xs font-semibold text-slate-600 shrink-0">
                    {n.isRead ? 'Dibaca Orang Tua' : 'Belum Dibaca'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
