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
  Eye,
  Folder,
  FolderPlus,
  History,
  Lock,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/audit';
import {
  DEFAULT_ARCHIVE_FOLDERS,
  DEFAULT_DIGITAL_ARCHIVES,
} from '../lib/seedData';
import {
  appendQuickActivityLog,
  loadQuickData,
  nextQuickId,
  QUICK_KEYS,
  saveQuickData,
} from '../lib/quickLocalStore';
import {
  ROLE_LABELS,
  type ArchiveFileType,
  type ArchiveFolder,
  type ArchiveRootCategory,
  type DigitalArchive,
  type UserRole,
} from '../types/sims';

const ROOT_CATEGORIES: ArchiveRootCategory[] = ['Manajerial', 'Kewirausahaan', 'Supervisi Tendik'];
const ALLOWED_EXTENSIONS: ArchiveFileType[] = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'JPG', 'PNG'];

export function ArchiveModule() {
  const { userAccount, effectiveRole, isQuickSession } = useAuth();
  const [folders, setFolders] = useState<ArchiveFolder[]>([]);
  const [archives, setArchives] = useState<DigitalArchive[]>([]);

  const [selectedRoot, setSelectedRoot] = useState<ArchiveRootCategory>('Manajerial');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('semua');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    parentFolderId: '',
    allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'] as UserRole[],
  });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    fileName: '',
    fileType: 'PDF' as ArchiveFileType,
    fileSize: 0,
    year: '2026',
    documentDate: new Date().toISOString().slice(0, 10),
    description: '',
    linkedIndicatorCode: '',
    contentDataUrl: '',
  });

  const [previewDoc, setPreviewDoc] = useState<DigitalArchive | null>(null);
  const [versionDoc, setVersionDoc] = useState<DigitalArchive | null>(null);
  const [newVersionNote, setNewVersionNote] = useState('');
  const [newVersionDataUrl, setNewVersionDataUrl] = useState('');
  const [newVersionFileName, setNewVersionFileName] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);

  const canManageArchives = ['super_admin', 'kepala_sekolah', 'tendik'].includes(effectiveRole);

  useEffect(() => {
    if (isQuickSession) {
      setFolders(loadQuickData(QUICK_KEYS.ARCHIVE_FOLDERS, DEFAULT_ARCHIVE_FOLDERS));
      setArchives(loadQuickData(QUICK_KEYS.DIGITAL_ARCHIVES, DEFAULT_DIGITAL_ARCHIVES));
      return;
    }

    const unsubs = [
      onSnapshot(
        collection(db, 'archive_folders'),
        (s) => {
          const list = s.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ArchiveFolder, 'id'>),
          }));
          setFolders(list);
        },
        (e) => handleFirestoreError(e, OperationType.LIST, 'archive_folders')
      ),
      onSnapshot(
        collection(db, 'digital_archives'),
        (s) => {
          setArchives(
            s.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<DigitalArchive, 'id'>),
            }))
          );
        },
        (e) => handleFirestoreError(e, OperationType.LIST, 'digital_archives')
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [isQuickSession]);

  const hasFolderAccess = (folder: ArchiveFolder) => {
    if (effectiveRole === 'super_admin' || effectiveRole === 'kepala_sekolah') return true;
    return folder.allowedRoles.includes(effectiveRole);
  };

  const rootFolders = folders.filter((f) => f.rootCategory === selectedRoot);
  const activeFolder = rootFolders.find((f) => f.id === selectedFolderId) || null;

  const visibleArchives = archives.filter((a) => {
    if (a.rootCategory !== selectedRoot) return false;
    const folder = folders.find((f) => f.id === a.folderId);
    if (folder && !hasFolderAccess(folder)) return false;
    if (selectedFolderId && a.folderId !== selectedFolderId) return false;

    const q = search.trim().toLowerCase();
    const matchText =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.fileName.toLowerCase().includes(q) ||
      (a.linkedIndicatorCode || '').toLowerCase().includes(q);
    const matchYear = yearFilter === 'semua' || a.year === yearFilter;
    const matchDate = !dateFilter || a.documentDate === dateFilter;
    return matchText && matchYear && matchDate;
  });

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, forRevision = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
    const mappedType: ArchiveFileType = ALLOWED_EXTENSIONS.includes(ext as ArchiveFileType)
      ? (ext as ArchiveFileType)
      : 'PDF';

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const safeDataUrl = dataUrl.length <= 850000 ? dataUrl : '';
      if (dataUrl.length > 850000) {
        setFeedback(
          'Ukuran berkas melebihi 650 KB untuk penyimpanan langsung; metadata & riwayat tetap disimpan.'
        );
      }
      if (forRevision) {
        setNewVersionDataUrl(safeDataUrl);
        setNewVersionFileName(file.name);
      } else {
        setUploadForm((prev) => ({
          ...prev,
          fileName: file.name,
          fileType: mappedType,
          fileSize: file.size,
          title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
          contentDataUrl: safeDataUrl,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount || !folderForm.name.trim()) return;
    if (isQuickSession) {
      const nextList: ArchiveFolder[] = [
        ...folders,
        {
          id: nextQuickId('fld'),
          name: folderForm.name.trim(),
          rootCategory: selectedRoot,
          parentFolderId: folderForm.parentFolderId,
          description: folderForm.description.trim(),
          allowedRoles:
            folderForm.allowedRoles.length > 0 ? folderForm.allowedRoles : ['super_admin'],
          authorUid: userAccount.uid,
        },
      ];
      setFolders(nextList);
      saveQuickData(QUICK_KEYS.ARCHIVE_FOLDERS, nextList);
      appendQuickActivityLog({
        actorUid: userAccount.uid,
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Buat Folder Arsip',
        module: 'Arsip Digital',
        details: `Membuat folder "${folderForm.name}" di direktori ${selectedRoot}.`,
      });
      setShowFolderModal(false);
      setFolderForm({
        name: '',
        description: '',
        parentFolderId: '',
        allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'],
      });
      setFeedback('Folder arsip baru berhasil dibuat.');
      return;
    }

    try {
      await addDoc(collection(db, 'archive_folders'), {
        name: folderForm.name.trim(),
        rootCategory: selectedRoot,
        parentFolderId: folderForm.parentFolderId,
        description: folderForm.description.trim(),
        allowedRoles:
          folderForm.allowedRoles.length > 0 ? folderForm.allowedRoles : ['super_admin'],
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Buat Folder Arsip',
        module: 'Arsip Digital',
        details: `Membuat folder "${folderForm.name}" di direktori ${selectedRoot}.`,
      });
      setShowFolderModal(false);
      setFolderForm({
        name: '',
        description: '',
        parentFolderId: '',
        allowedRoles: ['super_admin', 'kepala_sekolah', 'tendik', 'supervisor'],
      });
      setFeedback('Folder arsip baru berhasil dibuat.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'archive_folders');
    }
  };

  const handleUploadArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount) return;
    const targetFolderId = selectedFolderId || rootFolders[0]?.id || 'fld_man_1';
    if (isQuickSession) {
      const created: DigitalArchive = {
        id: nextQuickId('arc'),
        title: uploadForm.title.trim(),
        folderId: targetFolderId,
        rootCategory: selectedRoot,
        fileName: uploadForm.fileName || `${uploadForm.title}.pdf`,
        fileType: uploadForm.fileType,
        fileSize: uploadForm.fileSize,
        year: uploadForm.year,
        documentDate: uploadForm.documentDate,
        description: uploadForm.description.trim(),
        currentVersion: 1,
        versions: [
          {
            version: 1,
            updatedAt: new Date().toISOString().slice(0, 10),
            updatedBy: userAccount.displayName,
            note: 'Unggahan versi awal dokumen.',
          },
        ],
        contentDataUrl: uploadForm.contentDataUrl,
        linkedIndicatorCode: uploadForm.linkedIndicatorCode.trim(),
        uploadedByName: userAccount.displayName,
        authorUid: userAccount.uid,
      };
      const nextList = [created, ...archives];
      setArchives(nextList);
      saveQuickData(QUICK_KEYS.DIGITAL_ARCHIVES, nextList);
      appendQuickActivityLog({
        actorUid: userAccount.uid,
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Unggah Dokumen Arsip',
        module: 'Arsip Digital',
        details: `Mengunggah "${uploadForm.title}" (${uploadForm.fileType}) ke ${selectedRoot}.`,
      });
      setShowUploadModal(false);
      setUploadForm({
        title: '',
        fileName: '',
        fileType: 'PDF',
        fileSize: 0,
        year: '2026',
        documentDate: new Date().toISOString().slice(0, 10),
        description: '',
        linkedIndicatorCode: '',
        contentDataUrl: '',
      });
      setFeedback('Dokumen arsip berhasil disimpan.');
      return;
    }

    try {
      await addDoc(collection(db, 'digital_archives'), {
        title: uploadForm.title.trim(),
        folderId: targetFolderId,
        rootCategory: selectedRoot,
        fileName: uploadForm.fileName || `${uploadForm.title}.pdf`,
        fileType: uploadForm.fileType,
        fileSize: uploadForm.fileSize,
        year: uploadForm.year,
        documentDate: uploadForm.documentDate,
        description: uploadForm.description.trim(),
        currentVersion: 1,
        versions: [
          {
            version: 1,
            updatedAt: new Date().toISOString().slice(0, 10),
            updatedBy: userAccount.displayName,
            note: 'Unggahan versi awal dokumen.',
          },
        ],
        contentDataUrl: uploadForm.contentDataUrl,
        linkedIndicatorCode: uploadForm.linkedIndicatorCode.trim(),
        uploadedByName: userAccount.displayName,
        authorUid: userAccount.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Unggah Dokumen Arsip',
        module: 'Arsip Digital',
        details: `Mengunggah "${uploadForm.title}" (${uploadForm.fileType}) ke ${selectedRoot}.`,
      });
      setShowUploadModal(false);
      setUploadForm({
        title: '',
        fileName: '',
        fileType: 'PDF',
        fileSize: 0,
        year: '2026',
        documentDate: new Date().toISOString().slice(0, 10),
        description: '',
        linkedIndicatorCode: '',
        contentDataUrl: '',
      });
      setFeedback('Dokumen arsip berhasil disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'digital_archives');
    }
  };

  const handleAddRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAccount || !versionDoc) return;
    const nextVersion = (versionDoc.currentVersion || 1) + 1;
    const nextHistory = [
      ...(versionDoc.versions || []),
      {
        version: nextVersion,
        updatedAt: new Date().toISOString().slice(0, 10),
        updatedBy: userAccount.displayName,
        note: newVersionNote.trim() || `Pembaruan dokumen ke versi ${nextVersion}.`,
      },
    ];
    if (isQuickSession) {
      const nextList = archives.map((a) =>
        a.id === versionDoc.id
          ? {
              ...a,
              currentVersion: nextVersion,
              versions: nextHistory,
              ...(newVersionDataUrl ? { contentDataUrl: newVersionDataUrl } : {}),
            }
          : a
      );
      setArchives(nextList);
      saveQuickData(QUICK_KEYS.DIGITAL_ARCHIVES, nextList);
      appendQuickActivityLog({
        actorUid: userAccount.uid,
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Revisi Versi Arsip',
        module: 'Arsip Digital',
        details: `Memperbarui "${versionDoc.title}" ke versi v${nextVersion}${
          newVersionFileName ? ` (${newVersionFileName})` : ''
        }.`,
      });
      setVersionDoc(null);
      setNewVersionNote('');
      setNewVersionDataUrl('');
      setNewVersionFileName('');
      setFeedback(`Dokumen diperbarui ke versi v${nextVersion}.`);
      return;
    }

    try {
      await updateDoc(doc(db, 'digital_archives', versionDoc.id), {
        currentVersion: nextVersion,
        versions: nextHistory,
        ...(newVersionDataUrl ? { contentDataUrl: newVersionDataUrl } : {}),
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount.displayName,
        actorRole: effectiveRole,
        action: 'Revisi Versi Arsip',
        module: 'Arsip Digital',
        details: `Memperbarui "${versionDoc.title}" ke versi v${nextVersion}${
          newVersionFileName ? ` (${newVersionFileName})` : ''
        }.`,
      });
      setVersionDoc(null);
      setNewVersionNote('');
      setNewVersionDataUrl('');
      setNewVersionFileName('');
      setFeedback(`Dokumen diperbarui ke versi v${nextVersion}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `digital_archives/${versionDoc.id}`);
    }
  };

  const handleDownload = (item: DigitalArchive) => {
    if (item.contentDataUrl) {
      const link = document.createElement('a');
      link.href = item.contentDataUrl;
      link.download = item.fileName;
      link.click();
    } else {
      const content = `RINGKASAN METADATA ARSIP DIGITAL\nSMA Darul Ulum Kepohbaru\n\nJudul: ${item.title}\nKategori: ${item.rootCategory}\nBerkas: ${item.fileName} (${item.fileType})\nTanggal Dokumen: ${item.documentDate}\nVersi: v${item.currentVersion}\nDiunggah oleh: ${item.uploadedByName}\nDeskripsi: ${item.description || '-'}\n`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${item.title.replace(/\s+/g, '_')}_metadata.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDeleteArchive = async (item: DigitalArchive) => {
    if (isQuickSession) {
      const nextList = archives.filter((a) => a.id !== item.id);
      setArchives(nextList);
      saveQuickData(QUICK_KEYS.DIGITAL_ARCHIVES, nextList);
      appendQuickActivityLog({
        actorUid: userAccount?.uid,
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Hapus Dokumen Arsip',
        module: 'Arsip Digital',
        details: `Menghapus arsip "${item.title}".`,
      });
      setFeedback(`Arsip "${item.title}" dihapus.`);
      return;
    }

    try {
      await deleteDoc(doc(db, 'digital_archives', item.id));
      await logActivity({
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Hapus Dokumen Arsip',
        module: 'Arsip Digital',
        details: `Menghapus arsip "${item.title}".`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `digital_archives/${item.id}`);
    }
  };

  const toggleRolePermission = (role: UserRole) => {
    setFolderForm((prev) => ({
      ...prev,
      allowedRoles: prev.allowedRoles.includes(role)
        ? prev.allowedRoles.filter((r) => r !== role)
        : [...prev.allowedRoles, role],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-editorial font-semibold text-slate-950">
            Sistem Arsip Digital Sekolah
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Direktori terklasifikasi (Manajerial, Kewirausahaan, Supervisi Tendik) dengan kontrol akses folder & riwayat versi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageArchives && (
            <>
              <button
                type="button"
                onClick={() => setShowFolderModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 bg-white rounded-lg hover:bg-slate-50"
              >
                <FolderPlus className="w-4 h-4 text-emerald-800" /> Folder Baru
              </button>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900"
              >
                <Upload className="w-4 h-4" /> Unggah Dokumen
              </button>
            </>
          )}
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

      {/* 3 Root Directory Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {ROOT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setSelectedRoot(cat);
              setSelectedFolderId('');
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              selectedRoot === cat ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Sidebar Folder Tree */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Subfolder {selectedRoot}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedFolderId('')}
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              Semua Folder
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {rootFolders.map((folder) => {
              const accessible = hasFolderAccess(folder);
              const count = archives.filter((a) => a.folderId === folder.id).length;
              return (
                <button
                  key={folder.id}
                  type="button"
                  disabled={!accessible}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`w-full text-left py-3 px-2.5 flex items-start justify-between gap-2 rounded-lg transition-colors ${
                    selectedFolderId === folder.id
                      ? 'bg-emerald-50 text-emerald-950'
                      : accessible
                      ? 'hover:bg-slate-50 text-slate-800'
                      : 'opacity-50 cursor-not-allowed text-slate-400'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {accessible ? (
                      <Folder className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-semibold">{folder.name}</div>
                      {folder.description && (
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {folder.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-tabular text-slate-500 shrink-0">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document List & Search */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {activeFolder ? activeFolder.name : `Semua Dokumen ${selectedRoot}`}
              </h2>
              {activeFolder && (
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    Akses: {activeFolder.allowedRoles.map((r) => ROLE_LABELS[r]).join(', ')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama / kode butir..."
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-48"
                />
              </div>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-tabular"
              >
                <option value="semua">Semua Tahun</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2027">2027</option>
              </select>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-tabular"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {visibleArchives.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Belum ada dokumen arsip pada folder/filter ini.
              </div>
            ) : (
              visibleArchives.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50"
                >
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 font-tabular">
                      {item.fileType} · v{item.currentVersion} · {item.documentDate}
                      {item.linkedIndicatorCode ? ` · Kaitan Butir ${item.linkedIndicatorCode}` : ''}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-600">
                      Berkas: {item.fileName} · Pengunggah: {item.uploadedByName}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-white"
                    >
                      <Eye className="w-3.5 h-3.5" /> Pratinjau
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-white"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh
                    </button>
                    <button
                      type="button"
                      onClick={() => setVersionDoc(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-white"
                    >
                      <History className="w-3.5 h-3.5" /> Versi
                    </button>
                    {effectiveRole === 'super_admin' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteArchive(item)}
                        className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg"
                        aria-label="Hapus dokumen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Folder Baru */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateFolder} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">
                Tambah Folder ({selectedRoot})
              </h3>
              <button type="button" onClick={() => setShowFolderModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Folder</label>
              <input
                type="text"
                required
                value={folderForm.name}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Induk Subfolder (Opsional)</label>
              <select
                value={folderForm.parentFolderId}
                onChange={(e) => setFolderForm({ ...folderForm, parentFolderId: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              >
                <option value="">Folder Utama di {selectedRoot}</option>
                {rootFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    Subfolder dari: {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Deskripsi</label>
              <input
                type="text"
                value={folderForm.description}
                onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Hak Akses Peran
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['super_admin', 'kepala_sekolah', 'tendik', 'supervisor', 'guru', 'wali_kelas'] as UserRole[]).map(
                  (role) => (
                    <label key={role} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={folderForm.allowedRoles.includes(role)}
                        onChange={() => toggleRolePermission(role)}
                      />
                      <span>{ROLE_LABELS[role]}</span>
                    </label>
                  )
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowFolderModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                Batal
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                Simpan Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Upload Dokumen */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleUploadArchive} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Unggah Dokumen Arsip</h3>
              <button type="button" onClick={() => setShowUploadModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pilih Berkas (PDF, DOCX, XLSX, PPTX, JPG, PNG)
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png"
                onChange={(e) => handleFileInput(e, false)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Judul Dokumen</label>
              <input
                type="text"
                required
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Format</label>
                <select
                  value={uploadForm.fileType}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, fileType: e.target.value as ArchiveFileType })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                >
                  {ALLOWED_EXTENSIONS.map((ext) => (
                    <option key={ext} value={ext}>
                      {ext}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tahun</label>
                <input
                  type="text"
                  required
                  value={uploadForm.year}
                  onChange={(e) => setUploadForm({ ...uploadForm, year: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Dokumen</label>
                <input
                  type="date"
                  required
                  value={uploadForm.documentDate}
                  onChange={(e) => setUploadForm({ ...uploadForm, documentDate: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-tabular"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kaitan Kode Butir Supervisi (Opsional, misal 1.1 / 3.3 / S1.4)
              </label>
              <input
                type="text"
                value={uploadForm.linkedIndicatorCode}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, linkedIndicatorCode: e.target.value })
                }
                placeholder="Contoh: 1.4"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Keterangan Metadata</label>
              <textarea
                rows={2}
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-xs border rounded-lg">
                Batal
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                Simpan Dokumen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Preview Dokumen */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500 font-tabular">
                  {previewDoc.rootCategory} · {previewDoc.fileType} · v{previewDoc.currentVersion} ·{' '}
                  {previewDoc.documentDate}
                </div>
                <h3 className="text-lg font-semibold text-slate-950">{previewDoc.title}</h3>
              </div>
              <button type="button" onClick={() => setPreviewDoc(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600">{previewDoc.description || 'Tidak ada catatan tambahan.'}</p>

            {previewDoc.contentDataUrl && (previewDoc.fileType === 'JPG' || previewDoc.fileType === 'PNG') ? (
              <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
                <img
                  src={previewDoc.contentDataUrl}
                  alt={previewDoc.title}
                  className="max-h-[460px] mx-auto object-contain"
                />
              </div>
            ) : previewDoc.contentDataUrl && previewDoc.fileType === 'PDF' ? (
              <iframe
                src={previewDoc.contentDataUrl}
                title={previewDoc.title}
                className="w-full h-[460px] border border-slate-200 rounded-lg"
              />
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center space-y-2">
                <div className="text-sm font-semibold text-slate-900">{previewDoc.fileName}</div>
                <p className="text-xs text-slate-600">
                  Pratinjau visual langsung tersedia untuk PDF dan gambar (JPG/PNG). Untuk berkas{' '}
                  {previewDoc.fileType}, silakan unduh dokumen untuk membuka di aplikasi terkait.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownload(previewDoc)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg"
                >
                  <Download className="w-4 h-4" /> Unduh Dokumen
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Riwayat Versi & Unggah Revisi */}
      {versionDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">
                Riwayat Perubahan Dokumen
              </h3>
              <button type="button" onClick={() => setVersionDoc(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="text-sm font-medium text-slate-800">{versionDoc.title}</div>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              {(versionDoc.versions || []).map((v) => (
                <div key={v.version} className="p-3 text-xs space-y-0.5">
                  <div className="font-semibold text-slate-900 font-tabular">
                    Versi v{v.version} · {v.updatedAt} · {v.updatedBy}
                  </div>
                  <div className="text-slate-600">{v.note}</div>
                </div>
              ))}
            </div>
            {canManageArchives && (
              <form onSubmit={handleAddRevision} className="space-y-3 pt-2 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-800">
                  Catat Revisi / Unggah Versi Baru (v{(versionDoc.currentVersion || 1) + 1})
                </div>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileInput(e, true)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-1.5"
                />
                <input
                  type="text"
                  required
                  value={newVersionNote}
                  onChange={(e) => setNewVersionNote(e.target.value)}
                  placeholder="Catatan perubahan versi..."
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setVersionDoc(null)} className="px-3 py-1.5 text-xs border rounded-lg">
                    Tutup
                  </button>
                  <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg">
                    Simpan Versi Baru
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
