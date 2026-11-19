import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileSpreadsheet,
  FileText,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/audit';
import { DEFAULT_DIGITAL_ARCHIVES, DEFAULT_SUPERVISION_SCHEDULES } from '../lib/seedData';
import {
  appendQuickActivityLog,
  DEFAULT_QUICK_INDICATORS,
  DEFAULT_QUICK_INSTRUMENTS,
  DEFAULT_QUICK_SUPERVISION_ASSESSMENTS,
  loadQuickData,
  nextQuickId,
  QUICK_KEYS,
  saveQuickData,
} from '../lib/quickLocalStore';
import {
  calculatePredicate,
  calculateSheetSummary,
  groupIndicatorsByAspect,
  GURU_SUPERVISION_INDICATORS,
  GURU_SUPERVISION_INSTRUMENT,
  MASTER_PKKS_INDICATORS,
  MASTER_PKKS_INSTRUMENT,
  SHEET_METADATA,
  TENDIK_SUPERVISION_INDICATORS,
  TENDIK_SUPERVISION_INSTRUMENT,
} from '../lib/supervisionMasterData';
import { exportSupervisionToExcel, exportSupervisionToPDF } from '../lib/exportUtils';
import type {
  DigitalArchive,
  SupervisionAssessment,
  SupervisionIndicator,
  SupervisionInstrument,
  SupervisionItemScore,
  SupervisionSchedule,
} from '../types/sims';

type SupervisionTab = 'assessments' | 'schedules' | 'instruments' | 'recap';

export function SupervisionModule() {
  const { userAccount, effectiveRole, isQuickSession } = useAuth();
  const [tab, setTab] = useState<SupervisionTab>('assessments');

  const [instruments, setInstruments] = useState<SupervisionInstrument[]>([]);
  const [indicators, setIndicators] = useState<SupervisionIndicator[]>([]);
  const [schedules, setSchedules] = useState<SupervisionSchedule[]>([]);
  const [assessments, setAssessments] = useState<SupervisionAssessment[]>([]);
  const [archives, setArchives] = useState<DigitalArchive[]>([]);

  // Active assessment editor state
  const [activeAssessment, setActiveAssessment] = useState<SupervisionAssessment | null>(null);
  const [activeSheetCode, setActiveSheetCode] = useState<string>('utama');
  const [itemScores, setItemScores] = useState<Record<string, SupervisionItemScore>>({});
  const [sheetNotes, setSheetNotes] = useState<Record<string, string>>({});
  const [recommendations, setRecommendations] = useState('');
  const [followUpPlan, setFollowUpPlan] = useState('');
  const [followUpDeadline, setFollowUpDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filters for recap
  const [recapSearch, setRecapSearch] = useState('');
  const [recapPeriod, setRecapPeriod] = useState('semua');

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    instrumentId: '',
    academicYearName: '2026/2027',
    period: 'Semester Ganjil 2026',
    targetName: '',
    targetRole: 'Guru',
    supervisorName: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
  });

  const [showNewInstrumentModal, setShowNewInstrumentModal] = useState(false);
  const [instrumentForm, setInstrumentForm] = useState({
    code: '',
    title: '',
    targetType: 'guru' as 'kepala_sekolah' | 'guru' | 'tendik',
    year: '2026',
    description: '',
  });

  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false);
  const [newAssessmentForm, setNewAssessmentForm] = useState({
    instrumentId: 'inst_pkks_2026',
    academicYearName: '2026/2027',
    period: 'Semester Ganjil 2026',
    assessedPersonName: 'SALIM, S.Pd., M.Pd',
    assessedPersonRole: 'Kepala Sekolah',
    supervisorName: '',
  });

  const [selectedMasterInstId, setSelectedMasterInstId] = useState<string>('inst_pkks_2026');
  const [selectedMasterSheet, setSelectedMasterSheet] = useState<string>('utama');
  const [syncingMaster, setSyncingMaster] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const canSupervise = ['super_admin', 'kepala_sekolah', 'supervisor'].includes(effectiveRole);
  const canApprove = ['super_admin', 'kepala_sekolah'].includes(effectiveRole);

  useEffect(() => {
    if (isQuickSession) {
      setInstruments(loadQuickData(QUICK_KEYS.SUPERVISION_INSTRUMENTS, DEFAULT_QUICK_INSTRUMENTS));
      setIndicators(
        loadQuickData(QUICK_KEYS.SUPERVISION_INDICATORS, DEFAULT_QUICK_INDICATORS).sort(
          (a, b) => a.orderIndex - b.orderIndex
        )
      );
      setSchedules(
        loadQuickData(QUICK_KEYS.SUPERVISION_SCHEDULES, DEFAULT_SUPERVISION_SCHEDULES)
      );
      setAssessments(
        loadQuickData(
          QUICK_KEYS.SUPERVISION_ASSESSMENTS,
          DEFAULT_QUICK_SUPERVISION_ASSESSMENTS
        )
      );
      setArchives(loadQuickData(QUICK_KEYS.DIGITAL_ARCHIVES, DEFAULT_DIGITAL_ARCHIVES));
      return;
    }

    const unsubs = [
      onSnapshot(
        collection(db, 'supervision_instruments'),
        (s) =>
          setInstruments(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<SupervisionInstrument, 'id'>),
            }))
          ),
        (e) => handleFirestoreError(e, OperationType.LIST, 'supervision_instruments')
      ),
      onSnapshot(
        collection(db, 'supervision_indicators'),
        (s) =>
          setIndicators(
            s.docs
              .map((d) => ({
                id: d.id,
                ...(d.data() as Omit<SupervisionIndicator, 'id'>),
              }))
              .sort((a, b) => a.orderIndex - b.orderIndex)
          ),
        (e) => handleFirestoreError(e, OperationType.LIST, 'supervision_indicators')
      ),
      onSnapshot(
        collection(db, 'supervision_schedules'),
        (s) =>
          setSchedules(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<SupervisionSchedule, 'id'>),
            }))
          ),
        (e) => handleFirestoreError(e, OperationType.LIST, 'supervision_schedules')
      ),
      onSnapshot(
        collection(db, 'supervision_assessments'),
        (s) =>
          setAssessments(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<SupervisionAssessment, 'id'>),
            }))
          ),
        (e) => handleFirestoreError(e, OperationType.LIST, 'supervision_assessments')
      ),
      onSnapshot(
        collection(db, 'digital_archives'),
        (s) =>
          setArchives(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<DigitalArchive, 'id'>),
            }))
          ),
        (e) => handleFirestoreError(e, OperationType.LIST, 'digital_archives')
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [isQuickSession]);

  const getIndicatorsForInstrument = (instrumentId: string): SupervisionIndicator[] => {
    const fromDb = indicators.filter((i) => i.instrumentId === instrumentId);
    if (fromDb.length > 0) return fromDb;
    if (instrumentId === 'inst_pkks_2026') {
      return MASTER_PKKS_INDICATORS.map((ind, idx) => ({
        id: `ind_pkks_${idx + 1}`,
        instrumentId,
        ...ind,
        authorUid: 'master',
      }));
    }
    if (instrumentId === 'inst_guru_2026') {
      return GURU_SUPERVISION_INDICATORS.map((ind, idx) => ({
        id: `ind_guru_${idx + 1}`,
        instrumentId,
        ...ind,
        authorUid: 'master',
      }));
    }
    if (instrumentId === 'inst_tendik_2026') {
      return TENDIK_SUPERVISION_INDICATORS.map((ind, idx) => ({
        id: `ind_tendik_${idx + 1}`,
        instrumentId,
        ...ind,
        authorUid: 'master',
      }));
    }
    return [];
  };

  const openAssessmentEditor = (assessment: SupervisionAssessment) => {
    setActiveAssessment(assessment);
    const instIndicators = getIndicatorsForInstrument(assessment.instrumentId);
    const firstSheet = instIndicators[0]?.sheetCode || 'utama';
    setActiveSheetCode(firstSheet);
    setItemScores(assessment.itemScores || {});
    setSheetNotes(assessment.sheetNotes || {});
    setRecommendations(assessment.recommendations || '');
    setFollowUpPlan(assessment.followUpPlan || '');
    setFollowUpDeadline(assessment.followUpDeadline || '');
    setTab('assessments');
  };

  const startAssessmentFromSchedule = async (sch: SupervisionSchedule) => {
    if (!userAccount) return;
    const existing = assessments.find((a) => a.scheduleId === sch.id);
    if (existing) {
      openAssessmentEditor(existing);
      return;
    }
    const instIndicators = getIndicatorsForInstrument(sch.instrumentId);
    const maxScore = instIndicators.length * 4;

    if (isQuickSession) {
      const createdObj: SupervisionAssessment = {
        id: nextQuickId('asm'),
        scheduleId: sch.id,
        instrumentId: sch.instrumentId,
        instrumentTitle: sch.instrumentTitle,
        schoolName: 'SMA Darul Ulum Kepohbaru',
        assessedPersonName: sch.targetName,
        assessedPersonRole: sch.targetRole,
        assessedPersonEmail: sch.targetEmail || '',
        supervisorName: sch.supervisorName,
        academicYearName: sch.academicYearName,
        period: sch.period,
        itemScores: {},
        sheetNotes: {},
        overallScore: 0,
        overallMaxScore: maxScore,
        overallPercentage: 0,
        overallPredicate: 'Sangat Kurang',
        unfilledCount: instIndicators.length,
        recommendations: '',
        followUpPlan: '',
        followUpDeadline: '',
        status: 'Draft',
        authorUid: userAccount.uid,
      };
      const nextAssessments = [createdObj, ...assessments];
      const nextSchedules = schedules.map((item) =>
        item.id === sch.id ? { ...item, status: 'Berlangsung' as const } : item
      );
      setAssessments(nextAssessments);
      setSchedules(nextSchedules);
      saveQuickData(QUICK_KEYS.SUPERVISION_ASSESSMENTS, nextAssessments);
      saveQuickData(QUICK_KEYS.SUPERVISION_SCHEDULES, nextSchedules);
      openAssessmentEditor(createdObj);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'supervision_assessments'), {
        scheduleId: sch.id,
        instrumentId: sch.instrumentId,
        instrumentTitle: sch.instrumentTitle,
        schoolName: 'SMA Darul Ulum Kepohbaru',
        assessedPersonName: sch.targetName,
        assessedPersonRole: sch.targetRole,
        assessedPersonEmail: sch.targetEmail || '',
        supervisorName: sch.supervisorName,
        academicYearName: sch.academicYearName,
        period: sch.period,
        itemScores: {},
        sheetNotes: {},
        overallScore: 0,
        overallMaxScore: maxScore,
        overallPercentage: 0,
        overallPredicate: 'Sangat Kurang',
        unfilledCount: instIndicators.length,
        recommendations: '',
        followUpPlan: '',
        followUpDeadline: '',
        status: 'Draft',
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'supervision_schedules', sch.id), {
        status: 'Berlangsung',
        updatedAt: serverTimestamp(),
      });
      const createdObj: SupervisionAssessment = {
        id: docRef.id,
        scheduleId: sch.id,
        instrumentId: sch.instrumentId,
        instrumentTitle: sch.instrumentTitle,
        schoolName: 'SMA Darul Ulum Kepohbaru',
        assessedPersonName: sch.targetName,
        assessedPersonRole: sch.targetRole,
        assessedPersonEmail: sch.targetEmail || '',
        supervisorName: sch.supervisorName,
        academicYearName: sch.academicYearName,
        period: sch.period,
        itemScores: {},
        sheetNotes: {},
        overallScore: 0,
        overallMaxScore: maxScore,
        overallPercentage: 0,
        overallPredicate: 'Sangat Kurang',
        unfilledCount: instIndicators.length,
        status: 'Draft',
        authorUid: userAccount.uid,
      };
      openAssessmentEditor(createdObj);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'supervision_assessments');
    }
  };

  const activeIndicators = useMemo(() => {
    if (!activeAssessment) return [];
    return getIndicatorsForInstrument(activeAssessment.instrumentId);
  }, [activeAssessment, indicators]);

  const activeAspectGroups = useMemo(
    () => groupIndicatorsByAspect(activeIndicators),
    [activeIndicators]
  );

  const currentAspectGroup = useMemo(
    () =>
      activeAspectGroups.find((g) => g.sheetCode === activeSheetCode) ||
      activeAspectGroups[0] ||
      null,
    [activeAspectGroups, activeSheetCode]
  );

  const currentSheetSummary = useMemo(() => {
    const sheetTitle = currentAspectGroup?.sheetTitle || activeSheetCode;
    return calculateSheetSummary(activeSheetCode, sheetTitle, activeIndicators, itemScores);
  }, [activeSheetCode, currentAspectGroup, activeIndicators, itemScores]);

  const overallCalculation = useMemo(() => {
    let totalScore = 0;
    let maxScore = 0;
    let filled = 0;
    for (const ind of activeIndicators) {
      maxScore += ind.maxScale || 4;
      const sc = itemScores[ind.id];
      if (sc && sc.scale && sc.scale >= 1 && sc.scale <= 4) {
        totalScore += sc.scale;
        filled += 1;
      }
    }
    const unfilledCount = Math.max(0, activeIndicators.length - filled);
    const overallPercentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
    return {
      overallScore: totalScore,
      overallMaxScore: maxScore,
      overallPercentage,
      overallPredicate: calculatePredicate(overallPercentage),
      unfilledCount,
    };
  }, [activeIndicators, itemScores]);

  const isLocked = activeAssessment?.status === 'Disetujui' && effectiveRole !== 'super_admin';

  const setIndicatorScale = (indicatorId: string, scale: 1 | 2 | 3 | 4) => {
    if (isLocked || !canSupervise) return;
    setItemScores((prev) => ({
      ...prev,
      [indicatorId]: {
        ...(prev[indicatorId] || { note: '' }),
        scale,
        score: scale,
      },
    }));
  };

  const setIndicatorNote = (indicatorId: string, note: string) => {
    if (isLocked || !canSupervise) return;
    setItemScores((prev) => ({
      ...prev,
      [indicatorId]: {
        ...(prev[indicatorId] || { scale: null, score: 0 }),
        note,
      },
    }));
  };

  const linkArchiveToIndicator = (indicatorId: string, archiveId: string) => {
    if (isLocked || !canSupervise) return;
    const arch = archives.find((a) => a.id === archiveId);
    setItemScores((prev) => ({
      ...prev,
      [indicatorId]: {
        ...(prev[indicatorId] || { scale: null, score: 0, note: '' }),
        linkedArchiveId: archiveId,
        linkedArchiveTitle: arch?.title || '',
      },
    }));
  };

  const toggleEvidenceCheck = (indicatorId: string, evidenceIdx: number) => {
    if (isLocked || !canSupervise) return;
    setItemScores((prev) => {
      const existingEntry = prev[indicatorId] || { scale: null, score: 0, note: '', checkedEvidence: [] };
      const currentList = existingEntry.checkedEvidence || [];
      const nextList = currentList.includes(evidenceIdx)
        ? currentList.filter((i) => i !== evidenceIdx)
        : [...currentList, evidenceIdx];
      return {
        ...prev,
        [indicatorId]: {
          ...existingEntry,
          checkedEvidence: nextList,
        },
      };
    });
  };

  const handleSyncMasterInstrument = async () => {
    if (!userAccount || !canSupervise) return;
    if (isQuickSession) {
      setInstruments(DEFAULT_QUICK_INSTRUMENTS);
      setIndicators(DEFAULT_QUICK_INDICATORS);
      saveQuickData(QUICK_KEYS.SUPERVISION_INSTRUMENTS, DEFAULT_QUICK_INSTRUMENTS);
      saveQuickData(QUICK_KEYS.SUPERVISION_INDICATORS, DEFAULT_QUICK_INDICATORS);
      appendQuickActivityLog({
        actorUid: userAccount.uid,
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Sinkronkan Instrumen Master PDF',
        module: 'Supervisi Digital',
        details: 'Memperbarui 3 instrumen dan 88 butir master 8 aspek ke penyimpanan sesi lokal.',
      });
      setFeedback(
        'Seluruh 8 lembar dan 88 butir instrumen master (sesuai file PDF) siap digunakan pada sesi ini.'
      );
      return;
    }

    setSyncingMaster(true);
    setFeedback(null);
    try {
      const existingInstSnap = await getDocs(collection(db, 'supervision_instruments'));
      const existingInstIds = new Set(existingInstSnap.docs.map((d) => d.id));
      const existingIndSnap = await getDocs(collection(db, 'supervision_indicators'));
      const existingIndIds = new Set(existingIndSnap.docs.map((d) => d.id));

      const batch = writeBatch(db);
      const instrumentsToSync = [
        { id: 'inst_pkks_2026', data: MASTER_PKKS_INSTRUMENT },
        { id: 'inst_guru_2026', data: GURU_SUPERVISION_INSTRUMENT },
        { id: 'inst_tendik_2026', data: TENDIK_SUPERVISION_INSTRUMENT },
      ];

      for (const item of instrumentsToSync) {
        const ref = doc(db, 'supervision_instruments', item.id);
        if (existingInstIds.has(item.id)) {
          batch.update(ref, {
            title: item.data.title,
            description: item.data.description,
            year: item.data.year,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(ref, {
            ...item.data,
            authorUid: userAccount.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      const allIndicators = [
        ...MASTER_PKKS_INDICATORS.map((ind, idx) => ({
          id: `ind_pkks_${idx + 1}`,
          instrumentId: 'inst_pkks_2026',
          ind,
        })),
        ...GURU_SUPERVISION_INDICATORS.map((ind, idx) => ({
          id: `ind_guru_${idx + 1}`,
          instrumentId: 'inst_guru_2026',
          ind,
        })),
        ...TENDIK_SUPERVISION_INDICATORS.map((ind, idx) => ({
          id: `ind_tendik_${idx + 1}`,
          instrumentId: 'inst_tendik_2026',
          ind,
        })),
      ];

      for (const row of allIndicators) {
        const ref = doc(db, 'supervision_indicators', row.id);
        if (existingIndIds.has(row.id)) {
          batch.update(ref, {
            taskOrIndicator: row.ind.taskOrIndicator,
            physicalEvidence: row.ind.physicalEvidence,
            inspectionMethod: row.ind.inspectionMethod,
            generalItemLink: row.ind.generalItemLink,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(ref, {
            instrumentId: row.instrumentId,
            ...row.ind,
            authorUid: userAccount.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Sinkronkan Instrumen Master PDF',
        module: 'Supervisi Digital',
        details: 'Memperbarui 3 instrumen dan 98 butir indikator (88 butir master 8 lembar sesuai file PDF).',
      });
      setFeedback(
        'Seluruh 8 lembar dan 88 butir instrumen master (sesuai file PDF) berhasil disinkronkan ke database.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'supervision_indicators');
    } finally {
      setSyncingMaster(false);
    }
  };

  const handleStartDirectAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount) return;
    const inst =
      instruments.find((i) => i.id === newAssessmentForm.instrumentId) ||
      instruments[0] || { id: 'inst_pkks_2026', title: MASTER_PKKS_INSTRUMENT.title };
    const instIndicators = getIndicatorsForInstrument(inst.id);
    const maxScore = instIndicators.length * 4;

    if (isQuickSession) {
      const createdObj: SupervisionAssessment = {
        id: nextQuickId('asm'),
        scheduleId: '',
        instrumentId: inst.id,
        instrumentTitle: inst.title,
        schoolName: 'SMA Darul Ulum Kepohbaru',
        assessedPersonName: newAssessmentForm.assessedPersonName.trim(),
        assessedPersonRole: newAssessmentForm.assessedPersonRole.trim(),
        assessedPersonEmail: '',
        supervisorName: newAssessmentForm.supervisorName.trim() || userAccount.displayName,
        academicYearName: newAssessmentForm.academicYearName,
        period: newAssessmentForm.period,
        itemScores: {},
        sheetNotes: {},
        overallScore: 0,
        overallMaxScore: maxScore,
        overallPercentage: 0,
        overallPredicate: 'Sangat Kurang',
        unfilledCount: instIndicators.length,
        recommendations: '',
        followUpPlan: '',
        followUpDeadline: '',
        status: 'Draft',
        authorUid: userAccount.uid,
      };
      const nextList = [createdObj, ...assessments];
      setAssessments(nextList);
      saveQuickData(QUICK_KEYS.SUPERVISION_ASSESSMENTS, nextList);
      setShowNewAssessmentModal(false);
      openAssessmentEditor(createdObj);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'supervision_assessments'), {
        scheduleId: '',
        instrumentId: inst.id,
        instrumentTitle: inst.title,
        schoolName: 'SMA Darul Ulum Kepohbaru',
        assessedPersonName: newAssessmentForm.assessedPersonName.trim(),
        assessedPersonRole: newAssessmentForm.assessedPersonRole.trim(),
        assessedPersonEmail: '',
        supervisorName: newAssessmentForm.supervisorName.trim() || userAccount.displayName,
        academicYearName: newAssessmentForm.academicYearName,
        period: newAssessmentForm.period,
        itemScores: {},
        sheetNotes: {},
        overallScore: 0,
        overallMaxScore: maxScore,
        overallPercentage: 0,
        overallPredicate: 'Sangat Kurang',
        unfilledCount: instIndicators.length,
        recommendations: '',
        followUpPlan: '',
        followUpDeadline: '',
        status: 'Draft',
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowNewAssessmentModal(false);
      openAssessmentEditor({
        id: docRef.id,
        scheduleId: '',
        instrumentId: inst.id,
        instrumentTitle: inst.title,
        schoolName: 'SMA Darul Ulum Kepohbaru',
        assessedPersonName: newAssessmentForm.assessedPersonName.trim(),
        assessedPersonRole: newAssessmentForm.assessedPersonRole.trim(),
        supervisorName: newAssessmentForm.supervisorName.trim() || userAccount.displayName,
        academicYearName: newAssessmentForm.academicYearName,
        period: newAssessmentForm.period,
        itemScores: {},
        sheetNotes: {},
        overallScore: 0,
        overallMaxScore: maxScore,
        overallPercentage: 0,
        overallPredicate: 'Sangat Kurang',
        unfilledCount: instIndicators.length,
        status: 'Draft',
        authorUid: userAccount.uid,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'supervision_assessments');
    }
  };

  const handleSaveAssessment = async (targetStatus: 'Draft' | 'Selesai' | 'Disetujui') => {
    if (!activeAssessment || !userAccount) return;
    if (targetStatus === 'Selesai' && overallCalculation.unfilledCount > 0) {
      setFeedback(
        `Masih ada ${overallCalculation.unfilledCount} butir belum diisi (harus 0 sebelum diselesaikan).`
      );
      return;
    }
    setSaving(true);
    setFeedback(null);

    if (isQuickSession) {
      const updatedAssessment: SupervisionAssessment = {
        ...activeAssessment,
        itemScores,
        sheetNotes,
        ...overallCalculation,
        recommendations,
        followUpPlan,
        followUpDeadline,
        status: targetStatus,
        ...(targetStatus === 'Disetujui' ? { approvedByName: userAccount.displayName } : {}),
      };
      const nextAssessments = assessments.map((a) =>
        a.id === activeAssessment.id ? updatedAssessment : a
      );
      setAssessments(nextAssessments);
      saveQuickData(QUICK_KEYS.SUPERVISION_ASSESSMENTS, nextAssessments);
      if (activeAssessment.scheduleId) {
        const nextSchedStatus: SupervisionSchedule['status'] =
          targetStatus === 'Disetujui'
            ? 'Disetujui'
            : targetStatus === 'Selesai'
            ? 'Selesai'
            : 'Berlangsung';
        const nextSchedules = schedules.map((s) =>
          s.id === activeAssessment.scheduleId ? { ...s, status: nextSchedStatus } : s
        );
        setSchedules(nextSchedules);
        saveQuickData(QUICK_KEYS.SUPERVISION_SCHEDULES, nextSchedules);
      }
      setActiveAssessment(updatedAssessment);
      appendQuickActivityLog({
        actorUid: userAccount.uid,
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action:
          targetStatus === 'Disetujui'
            ? 'Validasi Hasil Supervisi'
            : 'Simpan Penilaian Supervisi',
        module: 'Supervisi Digital',
        details: `${activeAssessment.assessedPersonName} — Nilai ${overallCalculation.overallPercentage}% (${overallCalculation.overallPredicate}), Status: ${targetStatus}.`,
      });
      setFeedback(`Penilaian supervisi berhasil disimpan dengan status ${targetStatus}.`);
      setSaving(false);
      return;
    }

    try {
      const updatePayload: Record<string, unknown> = {
        itemScores,
        sheetNotes,
        overallScore: overallCalculation.overallScore,
        overallMaxScore: overallCalculation.overallMaxScore,
        overallPercentage: overallCalculation.overallPercentage,
        overallPredicate: overallCalculation.overallPredicate,
        unfilledCount: overallCalculation.unfilledCount,
        recommendations,
        followUpPlan,
        followUpDeadline,
        status: targetStatus,
        updatedAt: serverTimestamp(),
      };
      if (targetStatus === 'Disetujui') {
        updatePayload.approvedByName = userAccount.displayName;
      }

      await updateDoc(doc(db, 'supervision_assessments', activeAssessment.id), updatePayload);
      if (activeAssessment.scheduleId) {
        await updateDoc(doc(db, 'supervision_schedules', activeAssessment.scheduleId), {
          status: targetStatus === 'Disetujui' ? 'Disetujui' : targetStatus === 'Selesai' ? 'Selesai' : 'Berlangsung',
          updatedAt: serverTimestamp(),
        });
      }

      setActiveAssessment({
        ...activeAssessment,
        itemScores,
        sheetNotes,
        ...overallCalculation,
        recommendations,
        followUpPlan,
        followUpDeadline,
        status: targetStatus,
        ...(targetStatus === 'Disetujui' ? { approvedByName: userAccount.displayName } : {}),
      });

      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action:
          targetStatus === 'Disetujui'
            ? 'Validasi Hasil Supervisi'
            : 'Simpan Penilaian Supervisi',
        module: 'Supervisi Digital',
        details: `${activeAssessment.assessedPersonName} — Nilai ${overallCalculation.overallPercentage}% (${overallCalculation.overallPredicate}), Status: ${targetStatus}.`,
      });
      setFeedback(`Penilaian supervisi berhasil disimpan dengan status ${targetStatus}.`);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `supervision_assessments/${activeAssessment.id}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount) return;
    const inst =
      instruments.find((i) => i.id === scheduleForm.instrumentId) || instruments[0];
    if (!inst) return;

    if (isQuickSession) {
      const created: SupervisionSchedule = {
        id: nextQuickId('sch'),
        instrumentId: inst.id,
        instrumentTitle: inst.title,
        academicYearName: scheduleForm.academicYearName,
        period: scheduleForm.period,
        targetName: scheduleForm.targetName.trim(),
        targetRole: scheduleForm.targetRole.trim(),
        supervisorName: scheduleForm.supervisorName.trim() || userAccount.displayName,
        scheduledDate: scheduleForm.scheduledDate,
        status: 'Terjadwal',
        authorUid: userAccount.uid,
      };
      const nextList = [created, ...schedules];
      setSchedules(nextList);
      saveQuickData(QUICK_KEYS.SUPERVISION_SCHEDULES, nextList);
      setShowScheduleModal(false);
      setScheduleForm({
        instrumentId: instruments[0]?.id || '',
        academicYearName: '2026/2027',
        period: 'Semester Ganjil 2026',
        targetName: '',
        targetRole: 'Guru',
        supervisorName: '',
        scheduledDate: new Date().toISOString().slice(0, 10),
      });
      setFeedback('Jadwal supervisi baru berhasil dibuat.');
      return;
    }

    try {
      await addDoc(collection(db, 'supervision_schedules'), {
        instrumentId: inst.id,
        instrumentTitle: inst.title,
        academicYearName: scheduleForm.academicYearName,
        period: scheduleForm.period,
        targetName: scheduleForm.targetName.trim(),
        targetRole: scheduleForm.targetRole.trim(),
        supervisorName: scheduleForm.supervisorName.trim() || userAccount.displayName,
        scheduledDate: scheduleForm.scheduledDate,
        status: 'Terjadwal',
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowScheduleModal(false);
      setScheduleForm({
        instrumentId: instruments[0]?.id || '',
        academicYearName: '2026/2027',
        period: 'Semester Ganjil 2026',
        targetName: '',
        targetRole: 'Guru',
        supervisorName: '',
        scheduledDate: new Date().toISOString().slice(0, 10),
      });
      setFeedback('Jadwal supervisi baru berhasil dibuat.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'supervision_schedules');
    }
  };

  const handleCreateInstrument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount) return;
    if (isQuickSession) {
      const created: SupervisionInstrument = {
        id: nextQuickId('inst'),
        ...instrumentForm,
        authorUid: userAccount.uid,
      };
      const nextList = [...instruments, created];
      setInstruments(nextList);
      saveQuickData(QUICK_KEYS.SUPERVISION_INSTRUMENTS, nextList);
      setShowNewInstrumentModal(false);
      setInstrumentForm({ code: '', title: '', targetType: 'guru', year: '2026', description: '' });
      setFeedback('Instrumen supervisi baru ditambahkan.');
      return;
    }

    try {
      await addDoc(collection(db, 'supervision_instruments'), {
        ...instrumentForm,
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowNewInstrumentModal(false);
      setInstrumentForm({ code: '', title: '', targetType: 'guru', year: '2026', description: '' });
      setFeedback('Instrumen supervisi baru ditambahkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'supervision_instruments');
    }
  };

  const filteredRecap = assessments.filter((a) => {
    const q = recapSearch.trim().toLowerCase();
    const matchText =
      !q ||
      a.assessedPersonName.toLowerCase().includes(q) ||
      a.supervisorName.toLowerCase().includes(q) ||
      a.instrumentTitle.toLowerCase().includes(q);
    const matchPeriod = recapPeriod === 'semua' || a.period === recapPeriod;
    return matchText && matchPeriod;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-editorial font-semibold text-slate-950">
            Sistem Supervisi Digital Terintegrasi
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Mengadaptasi penuh Instrumen Master (8 Lembar, 88 Butir, Skala 1–4) dengan kalkulasi skor & predikat otomatis.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          {[
            { key: 'assessments', label: 'Formulir Penilaian' },
            { key: 'schedules', label: 'Jadwal Supervisi' },
            { key: 'instruments', label: 'Master Instrumen' },
            { key: 'recap', label: 'Rekapitulasi & Grafik' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as SupervisionTab)}
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
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs font-medium text-emerald-900">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: FORMULIR PENILAIAN DIGITAL */}
      {tab === 'assessments' && (
        <div className="space-y-6">
          {!activeAssessment ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Pilih Penilaian Supervisi Aktif atau Mulai dari Jadwal
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Setiap penilaian dapat diisi lintas 8 lembar dan diekspor ke PDF maupun Excel.
                  </p>
                </div>
                {canSupervise && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewAssessmentModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
                    >
                      <Plus className="w-4 h-4" /> Mulai Penilaian Baru
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('schedules')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      <ClipboardCheck className="w-4 h-4" /> Buka Jadwal Supervisi
                    </button>
                  </div>
                )}
              </div>

              {assessments.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center space-y-3">
                  <p className="text-sm text-slate-600">
                    Belum ada lembar penilaian supervisi aktif. Mulai penilaian langsung dari daftar
                    Jadwal Supervisi.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {schedules.map((sch) => (
                      <button
                        key={sch.id}
                        type="button"
                        onClick={() => startAssessmentFromSchedule(sch)}
                        className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
                      >
                        Mulai Penilaian: {sch.targetName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {assessments.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50"
                    >
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 font-tabular">
                          {a.academicYearName} · {a.period} · Status: {a.status}
                        </div>
                        <div className="text-sm font-semibold text-slate-900">
                          {a.assessedPersonName} — {a.instrumentTitle}
                        </div>
                        <div className="text-xs text-emerald-900 font-tabular font-semibold">
                          Skor: {a.overallScore}/{a.overallMaxScore} · Nilai:{' '}
                          {a.overallPercentage.toFixed(2)} · Predikat: {a.overallPredicate}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAssessmentEditor(a)}
                        className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 shrink-0"
                      >
                        Buka Formulir Penilaian
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Bar Penilaian Aktif + Real-time Scoreboard */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => setActiveAssessment(null)}
                      className="text-xs font-semibold text-emerald-800 hover:underline mb-2 inline-block"
                    >
                      ← Kembali ke Daftar Penilaian
                    </button>
                    <h2 className="text-xl font-editorial font-semibold text-slate-950">
                      {activeAssessment.instrumentTitle}
                    </h2>
                    <div className="text-xs text-slate-600 mt-1">
                      Dinilai: <span className="font-semibold text-slate-900">{activeAssessment.assessedPersonName}</span> ·
                      Supervisor: <span className="font-semibold text-slate-900">{activeAssessment.supervisorName}</span> ·
                      Periode: <span className="font-tabular">{activeAssessment.period}</span> ·
                      Status: <span className="font-semibold text-emerald-900">{activeAssessment.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportSupervisionToExcel(activeAssessment, activeIndicators)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => exportSupervisionToPDF(activeAssessment, activeIndicators)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-700" /> PDF
                    </button>
                  </div>
                </div>

                {/* Kalkulasi Otomatis Sesuai Rumus Master Excel */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-4 border-t border-slate-200">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-[11px] text-slate-500">Jumlah Skor (Total)</div>
                    <div className="text-lg font-tabular font-bold text-slate-900">
                      {overallCalculation.overallScore}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-[11px] text-slate-500">Skor Maksimal (n × 4)</div>
                    <div className="text-lg font-tabular font-bold text-slate-900">
                      {overallCalculation.overallMaxScore}
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-[11px] text-emerald-800">Nilai (Skor ÷ Maks × 100)</div>
                    <div className="text-lg font-tabular font-bold text-emerald-950">
                      {overallCalculation.overallPercentage.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-[11px] text-emerald-800">Predikat</div>
                    <div className="text-sm font-bold text-emerald-950 mt-0.5">
                      {overallCalculation.overallPredicate}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-[11px] text-slate-500">Belum Diisi (harus 0)</div>
                    <div
                      className={`text-lg font-tabular font-bold ${
                        overallCalculation.unfilledCount === 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {overallCalculation.unfilledCount}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-[11px] text-slate-500">Bertanda Ganda</div>
                    <div className="text-lg font-tabular font-bold text-emerald-700">0</div>
                  </div>
                </div>
              </div>

              {/* Sheet Tabs (8 Aspek / Lembar Instrumen Master) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {activeAspectGroups.map((group) => {
                  const summary = calculateSheetSummary(
                    group.sheetCode,
                    group.sheetTitle,
                    activeIndicators,
                    itemScores
                  );
                  return (
                    <button
                      key={group.sheetCode}
                      type="button"
                      onClick={() => setActiveSheetCode(group.sheetCode)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 transition-colors ${
                        activeSheetCode === group.sheetCode
                          ? 'bg-emerald-900 text-white border-emerald-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-tabular mr-1.5 opacity-80">{group.aspectIndex}.</span>
                      <span>{group.sheetTitle}</span>
                      <span className="ml-2 font-tabular opacity-80">
                        ({summary.filledItems}/{summary.totalItems})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Tabel Indikator Lembar Aktif (Dikelompokkan per Sub-Aspek) */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="border-b border-slate-200 pb-4 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    {currentAspectGroup?.headerTitle ||
                      SHEET_METADATA[activeSheetCode]?.headerTitle ||
                      'INSTRUMEN SUPERVISI DIGITAL'}
                  </div>
                  <h3 className="text-base font-semibold text-slate-950">
                    {currentAspectGroup?.subtitle ||
                      SHEET_METADATA[activeSheetCode]?.subtitle ||
                      currentSheetSummary.sheetTitle}
                  </h3>
                  {(currentAspectGroup?.guidance || SHEET_METADATA[activeSheetCode]?.guidance) && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {currentAspectGroup?.guidance || SHEET_METADATA[activeSheetCode]?.guidance}
                    </p>
                  )}
                  <div className="text-xs text-slate-500 font-tabular pt-1">
                    Skor Aspek {currentAspectGroup?.aspectIndex || 1}: {currentSheetSummary.totalScore} /{' '}
                    {currentSheetSummary.maxScore} · Nilai: {currentSheetSummary.percentage.toFixed(2)} ·
                    Predikat: {currentSheetSummary.predicate} · Kosong: {currentSheetSummary.unfilledItems}
                  </div>
                </div>

                <div className="space-y-6">
                  {(currentAspectGroup?.sections || []).map((section) => {
                    const sectionScore = section.items.reduce(
                      (acc, item) => acc + (itemScores[item.id]?.score || 0),
                      0
                    );
                    const sectionFilled = section.items.filter(
                      (item) => {
                        const sc = itemScores[item.id]?.scale;
                        return sc !== null && sc !== undefined && sc >= 1 && sc <= 4;
                      }
                    ).length;
                    return (
                      <div key={`${section.sectionCode}-${section.sectionTitle}`} className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                          <div className="text-xs font-semibold text-slate-900">
                            {section.sectionTitle}
                          </div>
                          <div className="text-xs font-tabular text-slate-600">
                            Terisi: {sectionFilled}/{section.itemCount} butir · Skor:{' '}
                            <span className="font-semibold text-emerald-900">
                              {sectionScore}/{section.maxScore}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {section.items.map((ind) => {
                            const current = itemScores[ind.id] || { scale: null, score: 0, note: '' };
                            const checkedList = current.checkedEvidence || [];
                            return (
                              <div
                                key={ind.id}
                                className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3"
                              >
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1">
                            <div className="text-xs text-emerald-800 font-semibold">
                              <span className="font-tabular">{ind.code}</span>
                              <span className="mx-1.5">·</span>
                              <span>{ind.sectionTitle}</span>
                              {ind.generalItemLink && (
                                <>
                                  <span className="mx-1.5">·</span>
                                  <span className="text-slate-500">Kaitan: {ind.generalItemLink}</span>
                                </>
                              )}
                              {ind.inspectionMethod && (
                                <>
                                  <span className="mx-1.5">·</span>
                                  <span className="text-slate-500">Cara: {ind.inspectionMethod}</span>
                                </>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-slate-950 leading-snug">
                              {ind.taskOrIndicator}
                            </div>
                            <div className="space-y-1 pt-1.5">
                              {ind.physicalEvidence.map((ev, i) => {
                                const isChecked = checkedList.includes(i);
                                return (
                                  <label
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={isLocked || !canSupervise}
                                      checked={isChecked}
                                      onChange={() => toggleEvidenceCheck(ind.id, i)}
                                      className="mt-0.5 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                                    />
                                    <span className={isChecked ? 'text-slate-900 font-medium' : ''}>
                                      {ev}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {/* Pilihan Tunggal Skala 1–4 */}
                          <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
                            <div className="text-[11px] font-medium text-slate-500">
                              Pilih Skala (1–4) · Skor:{' '}
                              <span className="font-tabular font-bold text-slate-900">
                                {current.score}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {([1, 2, 3, 4] as const).map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  disabled={isLocked || !canSupervise}
                                  onClick={() => setIndicatorScale(ind.id, val)}
                                  className={`w-10 h-10 rounded-lg text-sm font-tabular font-semibold border transition-colors ${
                                    current.scale === val
                                      ? 'bg-emerald-800 text-white border-emerald-800'
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 disabled:opacity-50'
                                  }`}
                                >
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Tautan Arsip Digital & Catatan Butir */}
                        <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <select
                              disabled={isLocked || !canSupervise}
                              value={current.linkedArchiveId || ''}
                              onChange={(e) => linkArchiveToIndicator(ind.id, e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="">Tautkan Bukti Fisik dari Arsip Digital...</option>
                              {archives.map((a) => (
                                <option key={a.id} value={a.id}>
                                  [{a.rootCategory}] {a.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="text"
                            disabled={isLocked || !canSupervise}
                            value={current.note || ''}
                            onChange={(e) => setIndicatorNote(ind.id, e.target.value)}
                            placeholder="Catatan pemeriksa untuk butir ini..."
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    );
                  })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Catatan Pemeriksa Spesifikasi */}
                <div className="pt-2 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Catatan Pemeriksa untuk {currentSheetSummary.sheetTitle} (temuan, kekuatan, saran)
                    </label>
                    <textarea
                      rows={3}
                      disabled={isLocked || !canSupervise}
                      value={sheetNotes[activeSheetCode] || ''}
                      onChange={(e) =>
                        setSheetNotes((prev) => ({ ...prev, [activeSheetCode]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      placeholder="Tuliskan temuan kekuatan dan area perbaikan untuk lembar ini..."
                    />
                  </div>

                  {/* Keterangan Predikat & Catatan Resmi Master PDF */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid md:grid-cols-2 gap-4 text-xs text-slate-700">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">Keterangan Predikat:</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-tabular">
                        <span>91 – 100 : Sangat Baik</span>
                        <span>76 – 90 : Baik</span>
                        <span>61 – 75 : Cukup (Butuh Perbaikan)</span>
                        <span>51 – 60 : Kurang</span>
                        <span>≤ 50 : Sangat Kurang</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">Catatan Ketentuan PKKS:</div>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                        <li>
                          Kepala Sekolah telah menyelesaikan Penilaian kinerja di Ruang GTK sampai
                          pada pemantauan refleksi dan evaluasi.
                        </li>
                        <li>
                          Kepala Sekolah mendapatkan nilai minimal Baik di PKKS untuk dapat
                          melanjutkan penilaian di Pengelolaan Kinerja di Ruang GTK.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rekomendasi, Tindak Lanjut & Validasi */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-950">
                  Rekomendasi, Rencana Tindak Lanjut (RTL) & Persetujuan
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Rekomendasi Perbaikan
                    </label>
                    <textarea
                      rows={3}
                      disabled={isLocked || !canSupervise}
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Rencana Tindak Lanjut (RTL)
                    </label>
                    <textarea
                      rows={3}
                      disabled={isLocked || !canSupervise}
                      value={followUpPlan}
                      onChange={(e) => setFollowUpPlan(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Target Tenggat Tindak Lanjut
                    </label>
                    <input
                      type="date"
                      disabled={isLocked || !canSupervise}
                      value={followUpDeadline}
                      onChange={(e) => setFollowUpDeadline(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canSupervise && !isLocked && (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveAssessment('Draft')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50"
                        >
                          <Save className="w-4 h-4" /> Simpan Draft
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveAssessment('Selesai')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Selesaikan Penilaian
                        </button>
                      </>
                    )}
                    {canApprove && activeAssessment.status !== 'Disetujui' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveAssessment('Disetujui')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-700 text-white rounded-lg hover:bg-amber-800"
                      >
                        <ShieldCheck className="w-4 h-4" /> Validasi & Setujui
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: JADWAL SUPERVISI */}
      {tab === 'schedules' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">Jadwal Supervisi GTK & Kepala Sekolah</h2>
            {canSupervise && (
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg"
              >
                <Plus className="w-4 h-4" /> Buat Jadwal Supervisi
              </button>
            )}
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                  <th className="py-2.5 px-3 font-semibold">Pihak Disupervisi</th>
                  <th className="py-2.5 px-3 font-semibold">Instrumen</th>
                  <th className="py-2.5 px-3 font-semibold">Supervisor</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {schedules.map((sch) => (
                  <tr key={sch.id}>
                    <td className="py-2.5 px-3 font-tabular text-xs">{sch.scheduledDate}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{sch.targetName}</div>
                      <div className="text-xs text-slate-500">{sch.targetRole}</div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-700">{sch.instrumentTitle}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-700">{sch.supervisorName}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-emerald-900">{sch.status}</td>
                    <td className="py-2.5 px-3 text-right">
                      {canSupervise && (
                        <button
                          type="button"
                          onClick={() => startAssessmentFromSchedule(sch)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
                        >
                          Buka Penilaian
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MASTER INSTRUMEN */}
      {tab === 'instruments' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Master Instrumen Supervisi (Sesuai File Master PDF)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Struktur lengkap 8 lembar (21 butir tugas utama + 67 butir spesifikasi = 88 butir)
                  beserta instrumen supervisi Guru dan Tenaga Kependidikan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  <Eye className="w-4 h-4" /> Lihat Dokumen Referensi (PDF)
                </button>
                {canSupervise && (
                  <>
                    <button
                      type="button"
                      disabled={syncingMaster}
                      onClick={handleSyncMasterInstrument}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-60"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingMaster ? 'animate-spin' : ''}`} />
                      {syncingMaster ? 'Menyinkronkan...' : 'Sinkronkan 88 Butir Master'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewInstrumentModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg"
                    >
                      <Plus className="w-4 h-4" /> Tambah Instrumen
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {(instruments.length > 0
                ? instruments
                : [
                    { id: 'inst_pkks_2026', ...MASTER_PKKS_INSTRUMENT, authorUid: 'master' },
                    { id: 'inst_guru_2026', ...GURU_SUPERVISION_INSTRUMENT, authorUid: 'master' },
                    { id: 'inst_tendik_2026', ...TENDIK_SUPERVISION_INSTRUMENT, authorUid: 'master' },
                  ]
              ).map((inst) => {
                const dbCount = indicators.filter((i) => i.instrumentId === inst.id).length;
                const fallbackCount =
                  inst.id === 'inst_pkks_2026'
                    ? MASTER_PKKS_INDICATORS.length
                    : inst.id === 'inst_guru_2026'
                    ? GURU_SUPERVISION_INDICATORS.length
                    : inst.id === 'inst_tendik_2026'
                    ? TENDIK_SUPERVISION_INDICATORS.length
                    : 0;
                const count = dbCount > 0 ? dbCount : fallbackCount;
                const isSelected = selectedMasterInstId === inst.id;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => {
                      setSelectedMasterInstId(inst.id);
                      const targetInds =
                        dbCount > 0
                          ? indicators.filter((i) => i.instrumentId === inst.id)
                          : inst.id === 'inst_guru_2026'
                          ? GURU_SUPERVISION_INDICATORS
                          : inst.id === 'inst_tendik_2026'
                          ? TENDIK_SUPERVISION_INDICATORS
                          : MASTER_PKKS_INDICATORS;
                      if (targetInds[0]) setSelectedMasterSheet(targetInds[0].sheetCode);
                    }}
                    className={`text-left border rounded-xl p-5 space-y-2 transition-colors ${
                      isSelected
                        ? 'border-emerald-800 bg-emerald-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-tabular font-semibold text-emerald-800">
                      {inst.code} · Tahun {inst.year}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-950">{inst.title}</h3>
                    <p className="text-xs text-slate-600">{inst.description}</p>
                    <div className="pt-2 text-xs font-tabular font-semibold text-slate-800">
                      {count} Butir Indikator · Maksimal {count * 4} Poin
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Penjelajah Lengkap Isi Instrumen Per Lembar */}
          {(() => {
            const dbInstInds = indicators.filter((i) => i.instrumentId === selectedMasterInstId);
            const explorerList =
              dbInstInds.length > 0
                ? dbInstInds
                : selectedMasterInstId === 'inst_guru_2026'
                ? GURU_SUPERVISION_INDICATORS.map((x, idx) => ({
                    ...x,
                    id: `fb_g_${idx}`,
                    instrumentId: 'inst_guru_2026',
                    authorUid: 'master',
                  }))
                : selectedMasterInstId === 'inst_tendik_2026'
                ? TENDIK_SUPERVISION_INDICATORS.map((x, idx) => ({
                    ...x,
                    id: `fb_t_${idx}`,
                    instrumentId: 'inst_tendik_2026',
                    authorUid: 'master',
                  }))
                : MASTER_PKKS_INDICATORS.map((x, idx) => ({
                    ...x,
                    id: `fb_p_${idx}`,
                    instrumentId: 'inst_pkks_2026',
                    authorUid: 'master',
                  }));

            const explorerAspectGroups = groupIndicatorsByAspect(explorerList);
            const activeExplorerGroup =
              explorerAspectGroups.find((g) => g.sheetCode === selectedMasterSheet) ||
              explorerAspectGroups[0];
            const activeSheetKey = activeExplorerGroup?.sheetCode || 'utama';
            const meta = SHEET_METADATA[activeSheetKey];

            return (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {explorerAspectGroups.map((group) => (
                    <button
                      key={group.sheetCode}
                      type="button"
                      onClick={() => setSelectedMasterSheet(group.sheetCode)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 ${
                        activeSheetKey === group.sheetCode
                          ? 'bg-emerald-900 text-white border-emerald-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-tabular mr-1 opacity-80">{group.aspectIndex}.</span>
                      {group.sheetTitle}
                      <span className="ml-1.5 font-tabular opacity-80">({group.itemCount})</span>
                    </button>
                  ))}
                </div>

                {meta && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                      {meta.headerTitle}
                    </div>
                    <div className="text-sm font-semibold text-slate-950">{meta.subtitle}</div>
                    <p className="text-xs text-slate-600">{meta.guidance}</p>
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold w-16">No</th>
                        <th className="py-2.5 px-3 font-semibold w-1/4">
                          Rincian Tugas / Indikator yang Diperiksa
                        </th>
                        <th className="py-2.5 px-3 font-semibold">Bukti Fisik / Hal yang Diperiksa</th>
                        <th className="py-2.5 px-3 font-semibold w-36">Cara Periksa</th>
                        <th className="py-2.5 px-3 font-semibold w-28">Kaitan Butir</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-20">Skala</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(activeExplorerGroup?.sections || []).map((section) => (
                        <React.Fragment key={`${section.sectionCode}-${section.sectionTitle}`}>
                          <tr className="bg-slate-50/90">
                            <td colSpan={6} className="py-2 px-3 font-semibold text-slate-800">
                              {section.sectionTitle}{' '}
                              <span className="font-tabular text-slate-500 font-normal">
                                ({section.itemCount} butir · Maks {section.maxScore} poin)
                              </span>
                            </td>
                          </tr>
                          {section.items.map((item) => (
                            <tr key={item.id} className="align-top hover:bg-slate-50">
                              <td className="py-3 px-3 font-tabular font-semibold text-emerald-900">
                                {item.code}
                              </td>
                              <td className="py-3 px-3 space-y-1">
                                <div className="font-medium text-slate-900">{item.taskOrIndicator}</div>
                              </td>
                              <td className="py-3 px-3">
                                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                  {item.physicalEvidence.map((ev, idx) => (
                                    <li key={idx}>{ev}</li>
                                  ))}
                                </ul>
                              </td>
                              <td className="py-3 px-3 text-slate-600">{item.inspectionMethod || '-'}</td>
                              <td className="py-3 px-3 font-tabular text-slate-600">
                                {item.generalItemLink || '-'}
                              </td>
                              <td className="py-3 px-3 text-center font-tabular font-semibold text-slate-700">
                                1 – {item.maxScale}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 4: REKAPITULASI & GRAFIK */}
      {tab === 'recap' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">
              Rekapitulasi & Riwayat Hasil Supervisi
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                <input
                  type="text"
                  value={recapSearch}
                  onChange={(e) => setRecapSearch(e.target.value)}
                  placeholder="Cari nama guru/supervisor..."
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-52"
                />
              </div>
              <select
                value={recapPeriod}
                onChange={(e) => setRecapPeriod(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              >
                <option value="semua">Semua Periode</option>
                {Array.from(new Set(assessments.map((a) => a.period))).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Nama Dinilai</th>
                  <th className="py-2.5 px-3 font-semibold">Periode</th>
                  <th className="py-2.5 px-3 font-semibold">Supervisor</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Skor</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Nilai</th>
                  <th className="py-2.5 px-3 font-semibold">Predikat</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ekspor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecap.map((a) => {
                  const instInds = getIndicatorsForInstrument(a.instrumentId);
                  return (
                    <tr key={a.id}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div>{a.assessedPersonName}</div>
                        <div className="text-xs text-slate-500">{a.instrumentTitle}</div>
                      </td>
                      <td className="py-2.5 px-3 text-xs">{a.period}</td>
                      <td className="py-2.5 px-3 text-xs">{a.supervisorName}</td>
                      <td className="py-2.5 px-3 text-right font-tabular text-xs">
                        {a.overallScore}/{a.overallMaxScore}
                      </td>
                      <td className="py-2.5 px-3 text-right font-tabular font-semibold text-emerald-900">
                        {a.overallPercentage.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-semibold">{a.overallPredicate}</td>
                      <td className="py-2.5 px-3 text-xs font-semibold">{a.status}</td>
                      <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => exportSupervisionToExcel(a, instInds)}
                          className="text-xs font-semibold text-emerald-800 hover:underline"
                        >
                          Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSupervisionToPDF(a, instInds)}
                          className="text-xs font-semibold text-red-700 hover:underline"
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Jadwal Baru */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateSchedule} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Buat Jadwal Supervisi</h3>
              <button type="button" onClick={() => setShowScheduleModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Instrumen Penilaian</label>
              <select
                value={scheduleForm.instrumentId}
                onChange={(e) => setScheduleForm({ ...scheduleForm, instrumentId: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.title}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              required
              placeholder="Nama Guru / Tendik / Kepala Sekolah yang Disupervisi"
              value={scheduleForm.targetName}
              onChange={(e) => setScheduleForm({ ...scheduleForm, targetName: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Jabatan (Guru / Tendik)"
                value={scheduleForm.targetRole}
                onChange={(e) => setScheduleForm({ ...scheduleForm, targetRole: e.target.value })}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="date"
                required
                value={scheduleForm.scheduledDate}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
              />
            </div>
            <input
              type="text"
              placeholder="Nama Supervisor"
              value={scheduleForm.supervisorName}
              onChange={(e) => setScheduleForm({ ...scheduleForm, supervisorName: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                Batal
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                Simpan Jadwal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Tambah Instrumen */}
      {showNewInstrumentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateInstrument} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Tambah Instrumen Supervisi</h3>
              <button type="button" onClick={() => setShowNewInstrumentModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Kode Instrumen (misal: SUP-BK-2026)"
              value={instrumentForm.code}
              onChange={(e) => setInstrumentForm({ ...instrumentForm, code: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              placeholder="Judul Instrumen"
              value={instrumentForm.title}
              onChange={(e) => setInstrumentForm({ ...instrumentForm, title: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={instrumentForm.targetType}
                onChange={(e) =>
                  setInstrumentForm({
                    ...instrumentForm,
                    targetType: e.target.value as 'kepala_sekolah' | 'guru' | 'tendik',
                  })
                }
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                <option value="guru">Guru</option>
                <option value="tendik">Tenaga Kependidikan</option>
                <option value="kepala_sekolah">Kepala Sekolah</option>
              </select>
              <input
                type="text"
                required
                value={instrumentForm.year}
                onChange={(e) => setInstrumentForm({ ...instrumentForm, year: e.target.value })}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Deskripsi instrumen"
              value={instrumentForm.description}
              onChange={(e) => setInstrumentForm({ ...instrumentForm, description: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewInstrumentModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                Batal
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                Simpan Instrumen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Mulai Penilaian Baru Langsung */}
      {showNewAssessmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleStartDirectAssessment} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Mulai Penilaian Supervisi</h3>
              <button type="button" onClick={() => setShowNewAssessmentModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Instrumen</label>
              <select
                value={newAssessmentForm.instrumentId}
                onChange={(e) =>
                  setNewAssessmentForm({ ...newAssessmentForm, instrumentId: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {(instruments.length > 0
                  ? instruments
                  : [{ id: 'inst_pkks_2026', title: MASTER_PKKS_INSTRUMENT.title }]
                ).map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama yang Dinilai (Kepala Sekolah / Guru / Tendik)
              </label>
              <input
                type="text"
                required
                value={newAssessmentForm.assessedPersonName}
                onChange={(e) =>
                  setNewAssessmentForm({ ...newAssessmentForm, assessedPersonName: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Jabatan</label>
                <input
                  type="text"
                  required
                  value={newAssessmentForm.assessedPersonRole}
                  onChange={(e) =>
                    setNewAssessmentForm({ ...newAssessmentForm, assessedPersonRole: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Periode</label>
                <input
                  type="text"
                  required
                  value={newAssessmentForm.period}
                  onChange={(e) =>
                    setNewAssessmentForm({ ...newAssessmentForm, period: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Supervisor / Penilai</label>
              <input
                type="text"
                placeholder={userAccount?.displayName || 'Supervisor'}
                value={newAssessmentForm.supervisorName}
                onChange={(e) =>
                  setNewAssessmentForm({ ...newAssessmentForm, supervisorName: e.target.value })
                }
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewAssessmentModal(false)}
                className="px-4 py-2 text-xs border rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg"
              >
                Buka Formulir
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Pratinjau PDF Referensi Master */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-950">
                Dokumen Referensi Instrumen Master (12 Halaman)
              </div>
              <button
                type="button"
                onClick={() => setShowPdfPreview(false)}
                className="p-1 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              src="/assets/aistudio/master_data_d34330d3.pdf"
              title="Referensi Master Instrumen Supervisi"
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
