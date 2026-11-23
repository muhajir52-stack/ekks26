import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  SupervisionAssessment,
  SupervisionIndicator,
  SupervisionOfficer,
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
