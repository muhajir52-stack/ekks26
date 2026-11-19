import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AttendanceRecord,
  GradeRecord,
  Student,
  SupervisionAssessment,
  SupervisionIndicator,
  SupervisionOfficer,
  TeacherStaff,
} from '../types/sims';
import { calculateSheetSummary } from './supervisionMasterData';

function resolveSupervisorSignatureInfo(
  assessment: SupervisionAssessment,
  matchedOfficer?: SupervisionOfficer
): {
  roleLabel: string;
  nameLabel: string;
  nipLabel: string;
  signatureDataUrl: string;
} {
  let roleLabel = 'Pengawas / Petugas Supervisor';
  let nameLabel = assessment.supervisorName || 'Petugas Supervisor';

  if (matchedOfficer) {
    roleLabel = matchedOfficer.unit;
    nameLabel = matchedOfficer.name;
  } else if (nameLabel.includes(': ')) {
    const idx = nameLabel.indexOf(': ');
    const possibleUnit = nameLabel.slice(0, idx).trim();
    const possibleName = nameLabel.slice(idx + 2).trim();
    if (possibleUnit && possibleName) {
      roleLabel = possibleUnit;
      nameLabel = possibleName;
    }
  }

  const nipRaw = (assessment.supervisorNip || matchedOfficer?.nip || '').trim();
  const nipLabel = nipRaw && nipRaw !== '-' ? nipRaw : '-';
  const signatureDataUrl = assessment.supervisorSignatureUrl || matchedOfficer?.signatureDataUrl || '';

  return { roleLabel, nameLabel, nipLabel, signatureDataUrl };
}

export function exportStudentsToExcel(students: Student[]): void {
  const rows = students.map((s, idx) => ({
    No: idx + 1,
    NIS: s.nis,
    NISN: s.nisn,
    'Nama Lengkap': s.name,
    'L/P': s.gender,
    Kelas: s.className,
    'Tahun Pelajaran': s.academicYearName || '-',
    Status: s.status.toUpperCase(),
    'Nama Orang Tua': s.parentName,
    'Email Orang Tua': s.parentEmail || '-',
    'Asal Sekolah': s.previousSchool || '-',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Master Siswa');
  XLSX.writeFile(wb, `Data_Siswa_SMA_Darul_Ulum_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportStudentsToPDF(students: Student[]): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  doc.setFontSize(14);
  doc.text('SMA DARUL ULUM KEPOHBARU — BOJONEGORO', 14, 14);
  doc.setFontSize(10);
  doc.text('Laporan Master Data Siswa', 14, 20);
  doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 25);

  autoTable(doc, {
    startY: 30,
    head: [['No', 'NIS', 'NISN', 'Nama Siswa', 'L/P', 'Kelas', 'Status', 'Orang Tua', 'Asal Sekolah']],
    body: students.map((s, i) => [
      i + 1,
      s.nis,
      s.nisn,
      s.name,
      s.gender,
      s.className,
      s.status,
      s.parentName,
      s.previousSchool || '-',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 81, 50] },
  });

  doc.save(`Laporan_Siswa_SMA_DU_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportTeachersToExcel(teachers: TeacherStaff[]): void {
  const rows = teachers.map((t, idx) => ({
    No: idx + 1,
    'NIP / NUPTK': t.nip,
    'Nama Lengkap': t.name,
    Kategori: t.staffType === 'guru' ? 'Guru' : 'Tenaga Kependidikan',
    Jabatan: t.position,
    'Mata Pelajaran': t.subjectName || '-',
    'Status Kepegawaian': t.employmentStatus,
    Email: t.email || '-',
    Telepon: t.phone || '-',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data GTK');
  XLSX.writeFile(wb, `Data_GTK_SMA_Darul_Ulum_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportGradesToExcel(grades: GradeRecord[]): void {
  const rows = grades.map((g, idx) => ({
    No: idx + 1,
    'Nama Siswa': g.studentName,
    Kelas: g.className,
    'Mata Pelajaran': g.subjectName,
    Semester: g.semester,
    'Tahun Pelajaran': g.academicYearName,
    UH: g.uhScore ?? '-',
    UTS: g.utsScore ?? '-',
    UAS: g.uasScore ?? '-',
    'Nilai Akhir': g.finalScore,
    Predikat: g.predicate,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nilai Akademik');
  XLSX.writeFile(wb, `Rekap_Nilai_SMA_DU_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportGradesToPDF(grades: GradeRecord[]): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  doc.setFontSize(13);
  doc.text('SMA DARUL ULUM KEPOHBARU — BOJONEGORO', 14, 14);
  doc.setFontSize(10);
  doc.text('Laporan Rekapitulasi Nilai Akademik Siswa', 14, 20);

  autoTable(doc, {
    startY: 26,
    head: [['No', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'UH', 'UTS', 'UAS', 'Akhir', 'Pred']],
    body: grades.map((g, i) => [
      i + 1,
      g.studentName,
      g.className,
      g.subjectName,
      g.uhScore ?? '-',
      g.utsScore ?? '-',
      g.uasScore ?? '-',
      g.finalScore,
      g.predicate,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 81, 50] },
  });

  doc.save(`Laporan_Nilai_SMA_DU_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportAttendanceToExcel(records: AttendanceRecord[]): void {
  const rows = records.map((r, i) => ({
    No: i + 1,
    Tanggal: r.date,
    'Nama Siswa': r.studentName,
    Kelas: r.className,
    'Mata Pelajaran / Sesi': r.subjectName || 'Harian',
    Status: r.status,
    Catatan: r.note || '-',
    Pencatat: r.recordedByName,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Absensi Siswa');
  XLSX.writeFile(wb, `Rekap_Absensi_SMA_DU_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportAttendanceToPDF(records: AttendanceRecord[]): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  doc.setFontSize(13);
  doc.text('SMA DARUL ULUM KEPOHBARU — BOJONEGORO', 14, 14);
  doc.setFontSize(10);
  doc.text('Laporan Rekapitulasi Kehadiran Siswa', 14, 20);

  autoTable(doc, {
    startY: 26,
    head: [['No', 'Tanggal', 'Nama Siswa', 'Kelas', 'Status', 'Keterangan', 'Pencatat']],
    body: records.map((r, i) => [
      i + 1,
      r.date,
      r.studentName,
      r.className,
      r.status,
      r.note || '-',
      r.recordedByName,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 81, 50] },
  });

  doc.save(`Laporan_Absensi_SMA_DU_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportSupervisionToExcel(
  assessment: SupervisionAssessment,
  indicators: SupervisionIndicator[],
  matchedOfficer?: SupervisionOfficer
): void {
  const wb = XLSX.utils.book_new();
  const itemScores = assessment.itemScores || {};
  const supInfo = resolveSupervisorSignatureInfo(assessment, matchedOfficer);
  const dateLabel = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Sheet groups
  const sheetMap = new Map<string, { title: string; items: SupervisionIndicator[] }>();
  for (const ind of indicators) {
    if (!sheetMap.has(ind.sheetCode)) {
      sheetMap.set(ind.sheetCode, { title: ind.sheetTitle, items: [] });
    }
    sheetMap.get(ind.sheetCode)!.items.push(ind);
  }

  // Summary sheet
  const summaryRows = Array.from(sheetMap.entries()).map(([code, grp]) => {
    const s = calculateSheetSummary(code, grp.title, indicators, itemScores);
    return {
      Lembar: grp.title,
      'Jumlah Butir': s.totalItems,
      'Terisi': s.filledItems,
      'Belum Diisi': s.unfilledItems,
      'Jumlah Skor': s.totalScore,
      'Skor Maksimal': s.maxScore,
      'Nilai (%)': s.percentage,
      Predikat: s.predicate,
    };
  });

  summaryRows.push({
    Lembar: 'TOTAL KESELURUHAN',
    'Jumlah Butir': indicators.length,
    'Terisi': indicators.length - assessment.unfilledCount,
    'Belum Diisi': assessment.unfilledCount,
    'Jumlah Skor': assessment.overallScore,
    'Skor Maksimal': assessment.overallMaxScore,
    'Nilai (%)': assessment.overallPercentage,
    Predikat: assessment.overallPredicate,
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.sheet_add_aoa(
    wsSummary,
    [
      [],
      ['LEMBAR PENGESAHAN HASIL SUPERVISI', '', '', '', '', '', `Kepohbaru, ${dateLabel}`],
      ['Pihak yang Dinilai', '', '', '', 'Pengawas / Petugas Supervisor', '', ''],
      [
        assessment.assessedPersonRole || 'GTK / Kepala Sekolah',
        '',
        '',
        '',
        supInfo.roleLabel,
        '',
        '',
      ],
      [
        '',
        '',
        '',
        '',
        supInfo.signatureDataUrl ? '[Ditandatangani Secara Digital]' : '(Tanda Tangan)',
        '',
        '',
      ],
      [assessment.assessedPersonName, '', '', '', supInfo.nameLabel, '', ''],
      ['', '', '', '', `NIP. ${supInfo.nipLabel}`, '', ''],
    ],
    { origin: -1 }
  );
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekapitulasi');

  // Detailed sheets
  for (const [code, grp] of sheetMap.entries()) {
    const rows = grp.items
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((ind) => {
        const sc = itemScores[ind.id];
        return {
          Kode: ind.code,
          Bagian: ind.sectionTitle,
          'Rincian Tugas / Indikator': ind.taskOrIndicator,
          'Bukti Fisik': ind.physicalEvidence.join('; '),
          'Cara Periksa': ind.inspectionMethod || '-',
          'Kaitan Butir Umum': ind.generalItemLink || '-',
          'Skala (1-4)': sc?.scale ?? '-',
          Skor: sc?.score ?? 0,
          'Bukti Arsip Tertaut': sc?.linkedArchiveTitle || '-',
          Catatan: sc?.note || '-',
        };
      });
    const ws = XLSX.utils.json_to_sheet(rows);
    const safeName = code.slice(0, 28);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }

  XLSX.writeFile(
    wb,
    `Laporan_Supervisi_${assessment.assessedPersonName.replace(/\s+/g, '_')}_${assessment.period.replace(/\s+/g, '_')}.xlsx`
  );
}

export function exportSupervisionToPDF(
  assessment: SupervisionAssessment,
  indicators: SupervisionIndicator[],
  matchedOfficer?: SupervisionOfficer
): void {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const itemScores = assessment.itemScores || {};
  const supInfo = resolveSupervisorSignatureInfo(assessment, matchedOfficer);
  const dateLabel = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const renderSignatureBlock = (startY: number) => {
    let blockY = startY;
    if (blockY > 235) {
      doc.addPage();
      blockY = 24;
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(14, blockY, 196, blockY);
    blockY += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Kepohbaru, Bojonegoro, ${dateLabel}`, 120, blockY);
    blockY += 5;

    // Kolom Kiri: Pihak yang Dinilai
    doc.text('Pihak yang Dinilai,', 18, blockY);
    doc.text(assessment.assessedPersonRole || 'Kepala Sekolah / GTK', 18, blockY + 4.5);

    // Kolom Kanan: Pengawas / Petugas Supervisor
    doc.text('Pengawas / Petugas Supervisor,', 120, blockY);
    doc.text(doc.splitTextToSize(supInfo.roleLabel, 72), 120, blockY + 4.5);

    const sigAreaY = blockY + 11;
    if (supInfo.signatureDataUrl) {
      try {
        const format = supInfo.signatureDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(supInfo.signatureDataUrl, format, 120, sigAreaY, 42, 15);
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('[Ditandatangani Secara Digital]', 120, sigAreaY + 17.5);
        doc.setTextColor(0, 0, 0);
      } catch {
        // Ignore invalid image data gracefully and keep blank wet-signature area
      }
    }

    const nameY = blockY + 32;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(assessment.assessedPersonName, 18, nameY);
    const assessedWidth = Math.max(42, doc.getTextWidth(assessment.assessedPersonName));
    doc.line(18, nameY + 1, 18 + assessedWidth, nameY + 1);

    doc.text(supInfo.nameLabel, 120, nameY);
    const supWidth = Math.max(46, doc.getTextWidth(supInfo.nameLabel));
    doc.line(120, nameY + 1, 120 + supWidth, nameY + 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`NIP. ${supInfo.nipLabel}`, 120, nameY + 5.5);

    if (assessment.status === 'Disetujui' && assessment.approvedByName) {
      doc.setFontSize(8);
      doc.setTextColor(15, 81, 50);
      doc.text(
        `Status Dokumen: Disetujui & Divalidasi oleh ${assessment.approvedByName}`,
        18,
        nameY + 12
      );
      doc.setTextColor(0, 0, 0);
    }
  };

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('SISTEM SUPERVISI DIGITAL — SMA DARUL ULUM KEPOHBARU', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(assessment.instrumentTitle, 14, 20);

  doc.setFontSize(9);
  doc.text(`Nama yang Dinilai : ${assessment.assessedPersonName}`, 14, 28);
  doc.text(`Supervisor        : ${supInfo.nameLabel} (${supInfo.roleLabel})`, 14, 33);
  doc.text(`Tahun / Periode   : ${assessment.academicYearName} (${assessment.period})`, 14, 38);
  doc.text(
    `Skor Total        : ${assessment.overallScore} / ${assessment.overallMaxScore}  |  Nilai: ${assessment.overallPercentage.toFixed(2)}  |  Predikat: ${assessment.overallPredicate}`,
    14,
    43
  );
  doc.text(`Status Validasi   : ${assessment.status}${assessment.approvedByName ? ` (${assessment.approvedByName})` : ''}`, 14, 48);

  const sheetMap = new Map<string, string>();
  for (const ind of indicators) {
    if (!sheetMap.has(ind.sheetCode)) sheetMap.set(ind.sheetCode, ind.sheetTitle);
  }

  const summaryBody = Array.from(sheetMap.entries()).map(([code, title]) => {
    const s = calculateSheetSummary(code, title, indicators, itemScores);
    return [title, s.totalItems, s.totalScore, s.maxScore, s.percentage.toFixed(2), s.predicate, s.unfilledItems];
  });

  autoTable(doc, {
    startY: 53,
    head: [['Aspek / Lembar Instrumen', 'Butir', 'Skor', 'Maks', 'Nilai', 'Predikat', 'Kosong']],
    body: summaryBody,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 81, 50] },
  });

  const afterSummaryY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 110;
  let noteY = afterSummaryY + 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Rekomendasi Supervisor:', 14, noteY);
  doc.setFont('helvetica', 'normal');
  const recLines = doc.splitTextToSize(assessment.recommendations || '-', 180);
  noteY += 5;
  doc.text(recLines, 14, noteY);
  noteY += recLines.length * 4.5 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Rencana Tindak Lanjut (RTL):', 14, noteY);
  doc.setFont('helvetica', 'normal');
  const rtlLines = doc.splitTextToSize(assessment.followUpPlan || '-', 180);
  noteY += 5;
  doc.text(rtlLines, 14, noteY);
  noteY += rtlLines.length * 4.5 + 8;

  renderSignatureBlock(noteY);

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Rincian Skor Per Indikator', 14, 14);
  doc.setFont('helvetica', 'normal');
  autoTable(doc, {
    startY: 20,
    head: [['Kode', 'Lembar', 'Indikator', 'Skala', 'Catatan']],
    body: [...indicators]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((ind) => {
        const sc = itemScores[ind.id];
        return [
          ind.code,
          ind.sheetCode,
          ind.taskOrIndicator.slice(0, 90),
          sc?.scale ?? '-',
          sc?.note || '-',
        ];
      }),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [15, 81, 50] },
  });

  const afterDetailY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 220;
  renderSignatureBlock(afterDetailY + 10);

  doc.save(
    `Laporan_Supervisi_${assessment.assessedPersonName.replace(/\s+/g, '_')}.pdf`
  );
}

export async function parseStudentsFromExcel(file: File): Promise<
  Array<{
    nis: string;
    nisn: string;
    name: string;
    gender: 'L' | 'P';
    className: string;
    parentName: string;
    parentEmail: string;
    previousSchool: string;
  }>
> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return json
    .map((row) => {
      const genderRaw = String(row['L/P'] || row['Jenis Kelamin'] || 'L').toUpperCase();
      return {
        nis: String(row['NIS'] || '').trim(),
        nisn: String(row['NISN'] || '').trim(),
        name: String(row['Nama Lengkap'] || row['Nama'] || '').trim(),
        gender: (genderRaw.startsWith('P') ? 'P' : 'L') as 'L' | 'P',
        className: String(row['Kelas'] || 'X-A').trim(),
        parentName: String(row['Nama Orang Tua'] || row['Orang Tua'] || 'Wali Siswa').trim(),
        parentEmail: String(row['Email Orang Tua'] || '').trim(),
        previousSchool: String(row['Asal Sekolah'] || '').trim(),
      };
    })
    .filter((item) => item.name.length > 0 && item.nis.length > 0);
}
