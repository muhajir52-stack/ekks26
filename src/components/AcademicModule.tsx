import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/audit';
import {
  exportGradesToExcel,
  exportGradesToPDF,
  exportStudentsToExcel,
  exportStudentsToPDF,
  exportTeachersToExcel,
  parseStudentsFromExcel,
} from '../lib/exportUtils';
import type {
  AcademicYear,
  GradeRecord,
  SchoolClass,
  Student,
  Subject,
  TeacherStaff,
} from '../types/sims';

type AcademicTab = 'students' | 'teachers' | 'structure' | 'grades';

export function AcademicModule() {
  const { userAccount, effectiveRole } = useAuth();
  const [tab, setTab] = useState<AcademicTab>('students');

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<TeacherStaff[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('semua');
  const [statusFilter, setStatusFilter] = useState('semua');

  // Modals / Forms
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    nis: '',
    nisn: '',
    name: '',
    gender: 'L' as 'L' | 'P',
    classId: '',
    status: 'aktif' as Student['status'],
    parentName: '',
    parentEmail: '',
    previousSchool: '',
  });
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    nip: '',
    name: '',
    staffType: 'guru' as 'guru' | 'tendik',
    position: '',
    subjectName: '',
    employmentStatus: 'GTY',
    email: '',
    phone: '',
  });

  const [classForm, setClassForm] = useState({ name: '', gradeLevel: 'X' as 'X' | 'XI' | 'XII', homeroomTeacherName: '' });
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', category: 'Umum', kkm: 75, hoursPerWeek: 2 });
  const [yearForm, setYearForm] = useState({ name: '2026/2027', semester: 'Ganjil' as 'Ganjil' | 'Genap' });

  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeForm, setGradeForm] = useState({
    studentId: '',
    subjectName: '',
    semester: 'Ganjil' as 'Ganjil' | 'Genap',
    uhScore: 85,
    utsScore: 85,
    uasScore: 85,
  });

  const [feedback, setFeedback] = useState<string | null>(null);

  const canManageMaster = ['super_admin', 'kepala_sekolah', 'tendik'].includes(effectiveRole);
  const canManageGrades = ['super_admin', 'kepala_sekolah', 'guru', 'wali_kelas'].includes(effectiveRole);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'students'), (s) =>
        setStudents(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) })))
      , (e) => handleFirestoreError(e, OperationType.LIST, 'students')),
      onSnapshot(collection(db, 'teachers'), (s) =>
        setTeachers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeacherStaff, 'id'>) })))
      , (e) => handleFirestoreError(e, OperationType.LIST, 'teachers')),
      onSnapshot(collection(db, 'classes'), (s) =>
        setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
      , (e) => handleFirestoreError(e, OperationType.LIST, 'classes')),
      onSnapshot(collection(db, 'subjects'), (s) =>
        setSubjects(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) })))
      , (e) => handleFirestoreError(e, OperationType.LIST, 'subjects')),
      onSnapshot(collection(db, 'academic_years'), (s) =>
        setAcademicYears(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) })))
      , (e) => handleFirestoreError(e, OperationType.LIST, 'academic_years')),
      onSnapshot(collection(db, 'grades'), (s) =>
        setGrades(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GradeRecord, 'id'>) })))
      , (e) => handleFirestoreError(e, OperationType.LIST, 'grades')),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const activeYearName = academicYears.find((y) => y.isActive)?.name || '2026/2027';

  const openAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({
      nis: '',
      nisn: '',
      name: '',
      gender: 'L',
      classId: classes[0]?.id || 'cls_x_a',
      status: 'aktif',
      parentName: '',
      parentEmail: '',
      previousSchool: '',
    });
    setShowStudentModal(true);
  };

  const openEditStudent = (s: Student) => {
    setEditingStudent(s);
    setStudentForm({
      nis: s.nis,
      nisn: s.nisn,
      name: s.name,
      gender: s.gender,
      classId: s.classId,
      status: s.status,
      parentName: s.parentName,
      parentEmail: s.parentEmail || '',
      previousSchool: s.previousSchool || '',
    });
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = userAccount?.uid;
    if (!uid) return;
    const selectedCls = classes.find((c) => c.id === studentForm.classId);
    const payload = {
      nis: studentForm.nis.trim(),
      nisn: studentForm.nisn.trim(),
      name: studentForm.name.trim(),
      gender: studentForm.gender,
      classId: studentForm.classId || 'cls_x_a',
      className: selectedCls?.name || 'X-A',
      academicYearName: activeYearName,
      status: studentForm.status,
      parentName: studentForm.parentName.trim(),
      parentEmail: studentForm.parentEmail.trim(),
      previousSchool: studentForm.previousSchool.trim(),
    };

    try {
      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        await logActivity({
          actorName: userAccount.displayName,
          actorRole: effectiveRole,
          action: 'Perbarui Data Siswa',
          module: 'Akademik',
          details: `Memperbarui data siswa ${payload.name} (${payload.nis}).`,
        });
        setFeedback(`Data siswa ${payload.name} berhasil diperbarui.`);
      } else {
        await addDoc(collection(db, 'students'), {
          ...payload,
          authorUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logActivity({
          actorName: userAccount.displayName,
          actorRole: effectiveRole,
          action: 'Tambah Siswa Baru',
          module: 'Akademik',
          details: `Menambahkan siswa ${payload.name} ke kelas ${payload.className}.`,
        });
        setFeedback(`Siswa ${payload.name} berhasil ditambahkan.`);
      }
      setShowStudentModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students');
    }
  };

  const handleDeleteStudent = async (s: Student) => {
    try {
      await deleteDoc(doc(db, 'students', s.id));
      await logActivity({
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Hapus Data Siswa',
        module: 'Akademik',
        details: `Menghapus data siswa ${s.name} (${s.nis}).`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${s.id}`);
    }
  };

  const handleImportStudents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userAccount) return;
    try {
      const parsed = await parseStudentsFromExcel(file);
      let count = 0;
      for (const row of parsed) {
        const cls = classes.find((c) => c.name.toLowerCase() === row.className.toLowerCase()) || classes[0];
        await addDoc(collection(db, 'students'), {
          nis: row.nis,
          nisn: row.nisn || row.nis,
          name: row.name,
          gender: row.gender,
          classId: cls?.id || 'cls_x_a',
          className: cls?.name || row.className,
          academicYearName: activeYearName,
          status: 'aktif',
          parentName: row.parentName,
          parentEmail: row.parentEmail,
          previousSchool: row.previousSchool,
          authorUid: userAccount.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        count += 1;
      }
      setFeedback(`Berhasil mengimpor ${count} data siswa dari Excel.`);
      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Impor Excel Siswa',
        module: 'Akademik',
        details: `Mengimpor ${count} siswa dari berkas ${file.name}.`,
      });
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Gagal membaca file Excel.');
    }
    e.target.value = '';
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount) return;
    try {
      await addDoc(collection(db, 'teachers'), {
        ...teacherForm,
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Tambah GTK',
        module: 'Akademik',
        details: `Menambahkan ${teacherForm.name} (${teacherForm.staffType}).`,
      });
      setShowTeacherModal(false);
      setTeacherForm({
        nip: '',
        name: '',
        staffType: 'guru',
        position: '',
        subjectName: '',
        employmentStatus: 'GTY',
        email: '',
        phone: '',
      });
      setFeedback('Data GTK berhasil disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'teachers');
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount || !classForm.name.trim()) return;
    try {
      await addDoc(collection(db, 'classes'), {
        name: classForm.name.trim(),
        gradeLevel: classForm.gradeLevel,
        academicYearName: activeYearName,
        homeroomTeacherName: classForm.homeroomTeacherName.trim() || 'Belum Ditunjuk',
        studentCount: 0,
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setClassForm({ name: '', gradeLevel: 'X', homeroomTeacherName: '' });
      setFeedback('Rombongan belajar baru berhasil ditambahkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'classes');
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount || !subjectForm.name.trim()) return;
    try {
      await addDoc(collection(db, 'subjects'), {
        ...subjectForm,
        kkm: Number(subjectForm.kkm),
        hoursPerWeek: Number(subjectForm.hoursPerWeek),
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSubjectForm({ code: '', name: '', category: 'Umum', kkm: 75, hoursPerWeek: 2 });
      setFeedback('Mata pelajaran berhasil ditambahkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'subjects');
    }
  };

  const handleAddAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount || !yearForm.name.trim()) return;
    try {
      await addDoc(collection(db, 'academic_years'), {
        name: yearForm.name.trim(),
        semester: yearForm.semester,
        isActive: false,
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setFeedback('Tahun pelajaran baru ditambahkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'academic_years');
    }
  };

  const handleActivateYear = async (target: AcademicYear) => {
    try {
      for (const y of academicYears) {
        if (y.id === target.id || y.isActive) {
          await updateDoc(doc(db, 'academic_years', y.id), {
            isActive: y.id === target.id,
            updatedAt: serverTimestamp(),
          });
        }
      }
      setFeedback(`Tahun Pelajaran ${target.name} (${target.semester}) diaktifkan.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'academic_years');
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount) return;
    const stu = students.find((s) => s.id === gradeForm.studentId);
    if (!stu) return;
    const uh = Number(gradeForm.uhScore);
    const uts = Number(gradeForm.utsScore);
    const uas = Number(gradeForm.uasScore);
    const finalScore = Math.round((uh + uts + uas) / 3);
    const predicate = finalScore >= 90 ? 'A' : finalScore >= 80 ? 'B' : finalScore >= 70 ? 'C' : 'D';

    try {
      await addDoc(collection(db, 'grades'), {
        studentId: stu.id,
        studentName: stu.name,
        classId: stu.classId,
        className: stu.className,
        subjectName: gradeForm.subjectName || subjects[0]?.name || 'Matematika',
        semester: gradeForm.semester,
        academicYearName: activeYearName,
        uhScore: uh,
        utsScore: uts,
        uasScore: uas,
        finalScore,
        predicate,
        parentEmail: stu.parentEmail || '',
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Input Nilai Akademik',
        module: 'Akademik',
        details: `Menyimpan nilai ${gradeForm.subjectName} untuk ${stu.name}: ${finalScore} (${predicate}).`,
      });
      setShowGradeModal(false);
      setFeedback(`Nilai ${stu.name} berhasil disimpan (${finalScore} / ${predicate}).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'grades');
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchText =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.nis.toLowerCase().includes(q) ||
      s.nisn.toLowerCase().includes(q);
    const matchCls = classFilter === 'semua' || s.className === classFilter;
    const matchStatus = statusFilter === 'semua' || s.status === statusFilter;
    return matchText && matchCls && matchStatus;
  });

  const filteredTeachers = teachers.filter((t) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.nip.toLowerCase().includes(q) ||
      (t.subjectName || '').toLowerCase().includes(q)
    );
  });

  const filteredGrades = grades.filter((g) => {
    const q = search.trim().toLowerCase();
    const matchText =
      !q ||
      g.studentName.toLowerCase().includes(q) ||
      g.subjectName.toLowerCase().includes(q);
    const matchCls = classFilter === 'semua' || g.className === classFilter;
    return matchText && matchCls;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-editorial font-semibold text-slate-950">
            Sistem Akademik & Manajemen Data Induk
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pengelolaan master siswa, guru & tendik, rombongan belajar, mata pelajaran, tahun pelajaran, serta rekap nilai.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          {[
            { key: 'students', label: 'Master Siswa' },
            { key: 'teachers', label: 'Guru & Tendik' },
            { key: 'structure', label: 'Kelas, Mapel & Tahun' },
            { key: 'grades', label: 'Nilai & Rekap' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as AcademicTab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors ${
                tab === item.key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs font-medium text-emerald-900">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: MASTER SISWA */}
      {tab === 'students' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, NIS, NISN..."
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-56"
                />
              </div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                <option value="semua">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                <option value="semua">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="lulus">Lulus</option>
                <option value="mutasi">Mutasi</option>
                <option value="cuti">Cuti</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManageMaster && (
                <>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Impor Excel
                    <input type="file" accept=".xlsx,.xls" onChange={handleImportStudents} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={openAddStudent}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Siswa
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => exportStudentsToExcel(filteredStudents)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportStudentsToPDF(filteredStudents)}
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
                  <th className="py-2.5 px-3 font-semibold">NIS / NISN</th>
                  <th className="py-2.5 px-3 font-semibold">Nama Siswa</th>
                  <th className="py-2.5 px-3 font-semibold">L/P</th>
                  <th className="py-2.5 px-3 font-semibold">Kelas</th>
                  <th className="py-2.5 px-3 font-semibold">Orang Tua & Email</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Belum ada data siswa yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-tabular text-xs">
                        <div className="font-semibold text-slate-900">{s.nis}</div>
                        <div className="text-slate-500">{s.nisn}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{s.name}</td>
                      <td className="py-2.5 px-3 text-xs">{s.gender}</td>
                      <td className="py-2.5 px-3 text-xs font-semibold text-emerald-900">{s.className}</td>
                      <td className="py-2.5 px-3 text-xs">
                        <div>{s.parentName}</div>
                        <div className="text-slate-500">{s.parentEmail || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-xs uppercase font-semibold">
                        <span className={s.status === 'aktif' ? 'text-emerald-700' : 'text-amber-700'}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setHistoryStudent(s)}
                          className="text-xs font-medium text-slate-700 hover:underline"
                        >
                          Riwayat
                        </button>
                        {canManageMaster && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditStudent(s)}
                              className="text-xs font-medium text-emerald-800 hover:underline"
                            >
                              Ubah
                            </button>
                            {effectiveRole === 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(s)}
                                className="text-xs font-medium text-red-700 hover:underline"
                              >
                                Hapus
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MASTER GURU & TENDIK */}
      {tab === 'teachers' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, NIP, mapel..."
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              {canManageMaster && (
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah GTK
                </button>
              )}
              <button
                type="button"
                onClick={() => exportTeachersToExcel(filteredTeachers)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" /> Ekspor Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">NIP / NUPTK</th>
                  <th className="py-2.5 px-3 font-semibold">Nama Lengkap</th>
                  <th className="py-2.5 px-3 font-semibold">Kategori</th>
                  <th className="py-2.5 px-3 font-semibold">Jabatan</th>
                  <th className="py-2.5 px-3 font-semibold">Bidang / Mapel</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTeachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-tabular text-xs">{t.nip}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{t.name}</td>
                    <td className="py-2.5 px-3 text-xs capitalize">{t.staffType}</td>
                    <td className="py-2.5 px-3 text-xs">{t.position}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-600">{t.subjectName || '-'}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold">{t.employmentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ROMBEL, MAPEL & TAHUN PELAJARAN */}
      {tab === 'structure' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tahun Pelajaran */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-950">Tahun Pelajaran & Semester</h2>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {academicYears.map((y) => (
                <div key={y.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold font-tabular">{y.name}</div>
                    <div className="text-xs text-slate-500">Semester {y.semester}</div>
                  </div>
                  {y.isActive ? (
                    <span className="text-xs font-semibold text-emerald-800">Aktif</span>
                  ) : (
                    canManageMaster && (
                      <button
                        type="button"
                        onClick={() => handleActivateYear(y)}
                        className="text-xs text-slate-600 hover:text-emerald-800 font-medium underline"
                      >
                        Aktifkan
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
            {canManageMaster && (
              <form onSubmit={handleAddAcademicYear} className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-700">Tambah Tahun Pelajaran</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={yearForm.name}
                    onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                    placeholder="2027/2028"
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <select
                    value={yearForm.semester}
                    onChange={(e) => setYearForm({ ...yearForm, semester: e.target.value as 'Ganjil' | 'Genap' })}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                  Simpan Tahun Pelajaran
                </button>
              </form>
            )}
          </div>

          {/* Rombongan Belajar & Wali Kelas */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-950">Rombongan Belajar & Wali Kelas</h2>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
              {classes.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">Wali: {c.homeroomTeacherName}</div>
                  </div>
                  <div className="text-xs font-tabular text-slate-600">Tingkat {c.gradeLevel}</div>
                </div>
              ))}
            </div>
            {canManageMaster && (
              <form onSubmit={handleAddClass} className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-700">Tambah Rombel Baru</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={classForm.name}
                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                    placeholder="Nama Kelas (X-B)"
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <select
                    value={classForm.gradeLevel}
                    onChange={(e) => setClassForm({ ...classForm, gradeLevel: e.target.value as 'X' | 'XI' | 'XII' })}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="X">Kelas X</option>
                    <option value="XI">Kelas XI</option>
                    <option value="XII">Kelas XII</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={classForm.homeroomTeacherName}
                  onChange={(e) => setClassForm({ ...classForm, homeroomTeacherName: e.target.value })}
                  placeholder="Nama Wali Kelas"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
                <button type="submit" className="w-full py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                  Simpan Kelas
                </button>
              </form>
            )}
          </div>

          {/* Mata Pelajaran */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-950">Master Mata Pelajaran</h2>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
              {subjects.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      {s.code} · {s.category}
                    </div>
                  </div>
                  <div className="text-xs font-tabular font-semibold text-emerald-900">KKM {s.kkm}</div>
                </div>
              ))}
            </div>
            {canManageMaster && (
              <form onSubmit={handleAddSubject} className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-700">Tambah Mata Pelajaran</div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                    placeholder="Kode"
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    placeholder="Nama Mapel"
                    className="col-span-2 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={subjectForm.category}
                    onChange={(e) => setSubjectForm({ ...subjectForm, category: e.target.value })}
                    placeholder="Kelompok"
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="number"
                    value={subjectForm.kkm}
                    onChange={(e) => setSubjectForm({ ...subjectForm, kkm: Number(e.target.value) })}
                    placeholder="KKM"
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <button type="submit" className="w-full py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                  Simpan Mata Pelajaran
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: NILAI AKADEMIK */}
      {tab === 'grades' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama siswa atau mapel..."
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-60"
                />
              </div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                <option value="semua">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {canManageGrades && (
                <button
                  type="button"
                  onClick={() => {
                    setGradeForm({
                      studentId: students[0]?.id || '',
                      subjectName: subjects[0]?.name || 'Matematika',
                      semester: 'Ganjil',
                      uhScore: 85,
                      utsScore: 85,
                      uasScore: 85,
                    });
                    setShowGradeModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
                >
                  <Plus className="w-3.5 h-3.5" /> Input Nilai
                </button>
              )}
              <button
                type="button"
                onClick={() => exportGradesToExcel(filteredGrades)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportGradesToPDF(filteredGrades)}
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
                  <th className="py-2.5 px-3 font-semibold">Nama Siswa</th>
                  <th className="py-2.5 px-3 font-semibold">Kelas</th>
                  <th className="py-2.5 px-3 font-semibold">Mata Pelajaran</th>
                  <th className="py-2.5 px-3 font-semibold">Semester</th>
                  <th className="py-2.5 px-3 font-semibold text-right">UH</th>
                  <th className="py-2.5 px-3 font-semibold text-right">UTS</th>
                  <th className="py-2.5 px-3 font-semibold text-right">UAS</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Nilai Akhir</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Predikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-tabular">
                {filteredGrades.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{g.studentName}</td>
                    <td className="py-2.5 px-3 font-sans text-xs">{g.className}</td>
                    <td className="py-2.5 px-3 font-sans text-xs">{g.subjectName}</td>
                    <td className="py-2.5 px-3 font-sans text-xs">{g.semester}</td>
                    <td className="py-2.5 px-3 text-right">{g.uhScore ?? '-'}</td>
                    <td className="py-2.5 px-3 text-right">{g.utsScore ?? '-'}</td>
                    <td className="py-2.5 px-3 text-right">{g.uasScore ?? '-'}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-900">{g.finalScore}</td>
                    <td className="py-2.5 px-3 text-center font-semibold">{g.predicate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Siswa */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveStudent}
            className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">
                {editingStudent ? 'Perbarui Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button type="button" onClick={() => setShowStudentModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">NIS</label>
                <input
                  type="text"
                  required
                  value={studentForm.nis}
                  onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">NISN</label>
                <input
                  type="text"
                  required
                  value={studentForm.nisn}
                  onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={studentForm.name}
                onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">L/P</label>
                <select
                  value={studentForm.gender}
                  onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as 'L' | 'P' })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kelas</label>
                <select
                  value={studentForm.classId}
                  onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={studentForm.status}
                  onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value as Student['status'] })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="aktif">Aktif</option>
                  <option value="lulus">Lulus</option>
                  <option value="mutasi">Mutasi</option>
                  <option value="cuti">Cuti</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Orang Tua</label>
                <input
                  type="text"
                  required
                  value={studentForm.parentName}
                  onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email Akun Orang Tua</label>
                <input
                  type="email"
                  value={studentForm.parentEmail}
                  onChange={(e) => setStudentForm({ ...studentForm, parentEmail: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                  placeholder="untuk notifikasi portal ortu"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Asal Sekolah (SMP/MTs)</label>
              <input
                type="text"
                value={studentForm.previousSchool}
                onChange={(e) => setStudentForm({ ...studentForm, previousSchool: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
              >
                Simpan Data Siswa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Riwayat Pendidikan & Perkembangan Siswa */}
      {historyStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">
                Riwayat Pendidikan & Rekap Nilai
              </h3>
              <button type="button" onClick={() => setHistoryStudent(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-sm">
              <div className="font-semibold text-slate-900">{historyStudent.name}</div>
              <div className="text-xs text-slate-600 font-tabular">
                NIS {historyStudent.nis} · NISN {historyStudent.nisn} · Kelas {historyStudent.className}
              </div>
              <div className="text-xs text-slate-600">
                Asal Sekolah: {historyStudent.previousSchool || 'Tidak tercatat'}
              </div>
              <div className="text-xs text-slate-600">
                Wali Murid: {historyStudent.parentName} ({historyStudent.parentEmail || '-'})
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Capaian Nilai Tercatat</div>
              {grades.filter((g) => g.studentId === historyStudent.id).length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada catatan nilai.</p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {grades
                    .filter((g) => g.studentId === historyStudent.id)
                    .map((g) => (
                      <div key={g.id} className="px-3 py-2 flex items-center justify-between text-xs">
                        <span>
                          {g.subjectName} ({g.semester} {g.academicYearName})
                        </span>
                        <span className="font-tabular font-semibold text-emerald-900">
                          {g.finalScore} ({g.predicate})
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah GTK */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleAddTeacher} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Tambah Guru / Tenaga Kependidikan</h3>
              <button type="button" onClick={() => setShowTeacherModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="NIP / NUPTK"
              value={teacherForm.nip}
              onChange={(e) => setTeacherForm({ ...teacherForm, nip: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              placeholder="Nama Lengkap & Gelar"
              value={teacherForm.name}
              onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={teacherForm.staffType}
                onChange={(e) => setTeacherForm({ ...teacherForm, staffType: e.target.value as 'guru' | 'tendik' })}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                <option value="guru">Guru</option>
                <option value="tendik">Tenaga Kependidikan</option>
              </select>
              <input
                type="text"
                placeholder="Status (GTY/PNS/PTY)"
                value={teacherForm.employmentStatus}
                onChange={(e) => setTeacherForm({ ...teacherForm, employmentStatus: e.target.value })}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <input
              type="text"
              required
              placeholder="Jabatan"
              value={teacherForm.position}
              onChange={(e) => setTeacherForm({ ...teacherForm, position: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              placeholder="Mata Pelajaran / Bidang Tugas"
              value={teacherForm.subjectName}
              onChange={(e) => setTeacherForm({ ...teacherForm, subjectName: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowTeacherModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                Batal
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                Simpan GTK
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Input Nilai */}
      {showGradeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveGrade} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Input Nilai Akademik</h3>
              <button type="button" onClick={() => setShowGradeModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Siswa</label>
              <select
                required
                value={gradeForm.studentId}
                onChange={(e) => setGradeForm({ ...gradeForm, studentId: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.className})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mata Pelajaran</label>
                <select
                  value={gradeForm.subjectName}
                  onChange={(e) => setGradeForm({ ...gradeForm, subjectName: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
                <select
                  value={gradeForm.semester}
                  onChange={(e) => setGradeForm({ ...gradeForm, semester: e.target.value as 'Ganjil' | 'Genap' })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">UH</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={gradeForm.uhScore}
                  onChange={(e) => setGradeForm({ ...gradeForm, uhScore: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">UTS</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={gradeForm.utsScore}
                  onChange={(e) => setGradeForm({ ...gradeForm, utsScore: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">UAS</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={gradeForm.uasScore}
                  onChange={(e) => setGradeForm({ ...gradeForm, uasScore: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowGradeModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                Batal
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                Simpan Nilai
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
