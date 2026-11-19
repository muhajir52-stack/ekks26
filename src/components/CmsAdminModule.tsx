import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Award,
  Calendar,
  Database,
  Download,
  FileText,
  Image,
  Megaphone,
  Newspaper,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { QUICK_ACCOUNTS, useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/audit';
import {
  compressImageFile,
  isRenderableImageUrl,
  parseSiteVisuals,
  SITE_VISUAL_SLOTS,
  type SiteVisualEntry,
  type SiteVisualKey,
} from '../lib/imageUtils';
import {
  appendQuickActivityLog,
  DEFAULT_QUICK_ACTIVITY_LOGS,
  loadQuickData,
  loadQuickRecord,
  nextQuickId,
  QUICK_KEYS,
  saveQuickData,
  saveQuickRecord,
} from '../lib/quickLocalStore';
import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_ANNOUNCEMENTS,
  DEFAULT_EVENTS,
  DEFAULT_GALLERY,
  DEFAULT_NEWS,
  DEFAULT_PUBLIC_DIRECTORY,
  DEFAULT_PUBLIC_PROFILE,
  seedInitialDatabase,
} from '../lib/seedData';
import type {
  AcademicEvent,
  Achievement,
  ActivityLog,
  Announcement,
  GalleryItem,
  NewsArticle,
  PublicDirectoryEntry,
  SchoolContent,
  UserAccount,
  UserRole,
} from '../types/sims';
import { ROLE_LABELS } from '../types/sims';

interface CmsAdminModuleProps {
  mode: 'cms' | 'users_audit';
  initialCmsTab?: CmsTab;
}

export type CmsTab = 'profil' | 'gambar' | 'berita_pengumuman' | 'kalender_prestasi' | 'direktori';
type AdminTab = 'users' | 'audit';

const SECTION_KEYS = [
  { key: 'profile', label: 'Profil & Sejarah Sekolah' },
  { key: 'vision_mission', label: 'Visi, Misi & Tujuan' },
  { key: 'organization', label: 'Struktur Organisasi' },
  { key: 'academic_info', label: 'Informasi Akademik & Kurikulum' },
  { key: 'ppdb', label: 'Informasi PPDB / SPMB' },
  { key: 'contact', label: 'Kontak & Layanan Informasi' },
];

export function CmsAdminModule({ mode, initialCmsTab }: CmsAdminModuleProps) {
  const { userAccount, effectiveRole, isQuickSession } = useAuth();
  const isRealAdmin = userAccount?.role === 'super_admin';
  const canManageCms = effectiveRole === 'super_admin' || effectiveRole === 'tendik';
  const canViewAudit = effectiveRole === 'super_admin' || effectiveRole === 'kepala_sekolah';

  const [cmsTab, setCmsTab] = useState<CmsTab>(initialCmsTab || 'profil');
  const [adminTab, setAdminTab] = useState<AdminTab>(isRealAdmin ? 'users' : 'audit');

  useEffect(() => {
    if (initialCmsTab) {
      setCmsTab(initialCmsTab);
    }
  }, [initialCmsTab]);

  // CMS State
  const [contentDocs, setContentDocs] = useState<Record<string, SchoolContent>>({});
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('profile');
  const [sectionForm, setSectionForm] = useState<{
    title: string;
    subtitle: string;
    body: string;
    items: { label: string; value: string; description?: string }[];
  }>({
    title: DEFAULT_PUBLIC_PROFILE.profile.title,
    subtitle: DEFAULT_PUBLIC_PROFILE.profile.subtitle || '',
    body: DEFAULT_PUBLIC_PROFILE.profile.body,
    items: DEFAULT_PUBLIC_PROFILE.profile.items || [],
  });
  const [savingSection, setSavingSection] = useState(false);

  // Site Visuals (Kelola Gambar) State
  const [visualForm, setVisualForm] = useState<Record<SiteVisualKey, SiteVisualEntry>>(() =>
    parseSiteVisuals(null)
  );
  const [savingVisuals, setSavingVisuals] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [editingImageTarget, setEditingImageTarget] = useState<{
    collection: 'news' | 'gallery_items';
    id: string;
    title: string;
    url: string;
  } | null>(null);
  const [savingTargetImage, setSavingTargetImage] = useState(false);

  const [news, setNews] = useState<NewsArticle[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [directory, setDirectory] = useState<PublicDirectoryEntry[]>([]);

  // Users & Audit State
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logModuleFilter, setLogModuleFilter] = useState('semua');

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Forms for CMS lists
  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'Akademik',
    summary: '',
    content: '',
    imageUrl: '',
    publishedDate: new Date().toISOString().slice(0, 10),
  });
  const [annForm, setAnnForm] = useState({
    title: '',
    content: '',
    audience: 'publik' as Announcement['audience'],
    priority: 'normal' as Announcement['priority'],
    publishedDate: new Date().toISOString().slice(0, 10),
  });
  const [eventForm, setEventForm] = useState({
    title: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    category: 'Akademik',
    description: '',
  });
  const [achForm, setAchForm] = useState({
    title: '',
    recipientName: '',
    level: 'Kabupaten' as Achievement['level'],
    year: '2026',
    category: 'Akademik',
    description: '',
  });
  const [galForm, setGalForm] = useState({
    title: '',
    mediaType: 'foto' as GalleryItem['mediaType'],
    category: 'Kegiatan Sekolah',
    caption: '',
    mediaUrl: '',
    eventDate: new Date().toISOString().slice(0, 10),
  });
  const [dirForm, setDirForm] = useState({
    name: '',
    roleType: 'guru' as PublicDirectoryEntry['roleType'],
    position: '',
    subject: '',
    education: '',
  });

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const hasLocalKey = (key: string) => {
      try {
        return localStorage.getItem(key) !== null;
      } catch {
        return false;
      }
    };

    if (mode === 'cms') {
      if (isQuickSession) {
        const localContent = loadQuickRecord<Record<string, SchoolContent>>(
          QUICK_KEYS.SCHOOL_CONTENT,
          {}
        );
        const initialContent: Record<string, SchoolContent> = {};
        Object.entries(DEFAULT_PUBLIC_PROFILE).forEach(([k, val]) => {
          initialContent[k] = { id: k, ...val, updatedByUid: 'system' };
        });
        Object.entries(localContent).forEach(([k, val]) => {
          initialContent[k] = val;
        });
        setContentDocs(initialContent);

        setNews(
          loadQuickData<NewsArticle>(
            QUICK_KEYS.NEWS,
            DEFAULT_NEWS.map((n, i) => ({ ...n, id: `def_n_${i}`, authorUid: 'system' }))
          )
        );
        setAnnouncements(
          loadQuickData<Announcement>(
            QUICK_KEYS.ANNOUNCEMENTS,
            DEFAULT_ANNOUNCEMENTS.map((a, i) => ({ ...a, id: `def_a_${i}`, authorUid: 'system' }))
          )
        );
        setEvents(
          loadQuickData<AcademicEvent>(
            QUICK_KEYS.EVENTS,
            DEFAULT_EVENTS.map((ev, i) => ({ ...ev, id: `def_e_${i}`, authorUid: 'system' }))
          )
        );
        setAchievements(
          loadQuickData<Achievement>(
            QUICK_KEYS.ACHIEVEMENTS,
            DEFAULT_ACHIEVEMENTS.map((ac, i) => ({ ...ac, id: `def_ac_${i}`, authorUid: 'system' }))
          )
        );
        setGallery(
          loadQuickData<GalleryItem>(
            QUICK_KEYS.GALLERY,
            DEFAULT_GALLERY.map((g, i) => ({ ...g, id: `def_g_${i}`, authorUid: 'system' }))
          )
        );
        setDirectory(
          loadQuickData<PublicDirectoryEntry>(
            QUICK_KEYS.DIRECTORY,
            DEFAULT_PUBLIC_DIRECTORY.map((d, i) => ({ ...d, id: `def_d_${i}`, authorUid: 'system' }))
          )
        );
      }

      unsubs.push(
        onSnapshot(
          collection(db, 'school_content'),
          (s) => {
            const map: Record<string, SchoolContent> = {};
            if (isQuickSession) {
              Object.entries(DEFAULT_PUBLIC_PROFILE).forEach(([k, val]) => {
                map[k] = { id: k, ...val, updatedByUid: 'system' };
              });
            }
            s.forEach((d) => {
              map[d.id] = { id: d.id, ...(d.data() as Omit<SchoolContent, 'id'>) };
            });
            if (isQuickSession) {
              const localContent = loadQuickRecord<Record<string, SchoolContent>>(
                QUICK_KEYS.SCHOOL_CONTENT,
                {}
              );
              Object.entries(localContent).forEach(([k, val]) => {
                map[k] = val;
              });
            }
            setContentDocs(map);
          },
          () => {}
        ),
        onSnapshot(
          collection(db, 'news'),
          (s) => {
            if (isQuickSession && hasLocalKey(QUICK_KEYS.NEWS)) return;
            if (isQuickSession && s.empty) return;
            setNews(
              s.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<NewsArticle, 'id'>) }))
                .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
            );
          },
          () => {}
        ),
        onSnapshot(
          collection(db, 'announcements'),
          (s) => {
            if (isQuickSession && hasLocalKey(QUICK_KEYS.ANNOUNCEMENTS)) return;
            if (isQuickSession && s.empty) return;
            setAnnouncements(
              s.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
                .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
            );
          },
          () => {}
        ),
        onSnapshot(
          collection(db, 'academic_events'),
          (s) => {
            if (isQuickSession && hasLocalKey(QUICK_KEYS.EVENTS)) return;
            if (isQuickSession && s.empty) return;
            setEvents(
              s.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicEvent, 'id'>) }))
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
            );
          },
          () => {}
        ),
        onSnapshot(
          collection(db, 'achievements'),
          (s) => {
            if (isQuickSession && hasLocalKey(QUICK_KEYS.ACHIEVEMENTS)) return;
            if (isQuickSession && s.empty) return;
            setAchievements(
              s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Achievement, 'id'>) }))
            );
          },
          () => {}
        ),
        onSnapshot(
          collection(db, 'gallery_items'),
          (s) => {
            if (isQuickSession && hasLocalKey(QUICK_KEYS.GALLERY)) return;
            if (isQuickSession && s.empty) return;
            setGallery(
              s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GalleryItem, 'id'>) }))
            );
          },
          () => {}
        ),
        onSnapshot(
          collection(db, 'public_directory'),
          (s) => {
            if (isQuickSession && hasLocalKey(QUICK_KEYS.DIRECTORY)) return;
            if (isQuickSession && s.empty) return;
            setDirectory(
              s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicDirectoryEntry, 'id'>) }))
            );
          },
          () => {}
        )
      );
    }

    if (mode === 'users_audit') {
      if (isQuickSession) {
        if (isRealAdmin) {
          const defaultQuickUsers: UserAccount[] = QUICK_ACCOUNTS.map((q) => ({
            id: q.id,
            uid: q.uid,
            email: q.email,
            displayName: q.displayName,
            role: q.role,
            activeStatus: 'aktif',
          }));
          setUsers(loadQuickData<UserAccount>('sims_quick_users', defaultQuickUsers));
        }
        if (canViewAudit) {
          setLogs(loadQuickData<ActivityLog>(QUICK_KEYS.ACTIVITY_LOGS, DEFAULT_QUICK_ACTIVITY_LOGS));
        }
        return () => unsubs.forEach((u) => u());
      }

      if (isRealAdmin) {
        unsubs.push(
          onSnapshot(
            collection(db, 'users'),
            (s) =>
              setUsers(
                s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserAccount, 'id'>) }))
              ),
            (e) => handleFirestoreError(e, OperationType.LIST, 'users')
          )
        );
      }

      if (canViewAudit) {
        unsubs.push(
          onSnapshot(
            collection(db, 'activity_logs'),
            (s) => {
              const list = s.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<ActivityLog, 'id'>),
              }));
              setLogs(list);
            },
            () => {}
          )
        );
      }
    }

    return () => unsubs.forEach((u) => u());
  }, [mode, isRealAdmin, canViewAudit, isQuickSession]);

  // Sync editor form when switching sectionKey or when contentDocs loads
  useEffect(() => {
    const existing = contentDocs[selectedSectionKey];
    const fallback = DEFAULT_PUBLIC_PROFILE[selectedSectionKey];
    const source = existing || fallback;
    if (source) {
      setSectionForm({
        title: source.title,
        subtitle: source.subtitle || '',
        body: source.body,
        items: (source.items || []).map((i) => ({
          label: i.label,
          value: i.value,
          description: i.description || '',
        })),
      });
    }
  }, [selectedSectionKey, contentDocs]);

  useEffect(() => {
    setVisualForm(parseSiteVisuals(contentDocs.site_visuals));
  }, [contentDocs.site_visuals]);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCms) return;
    setSavingSection(true);
    try {
      const cleanedItems = sectionForm.items
        .filter((it) => it.label.trim() && it.value.trim())
        .slice(0, 30)
        .map((it) => ({
          label: it.label.trim(),
          value: it.value.trim(),
          description: (it.description || '').trim(),
        }));

      if (isQuickSession) {
        const updatedSection: SchoolContent = {
          id: selectedSectionKey,
          sectionKey: selectedSectionKey,
          title: sectionForm.title.trim(),
          subtitle: sectionForm.subtitle.trim(),
          body: sectionForm.body.trim(),
          items: cleanedItems,
          updatedByUid: userAccount?.uid || 'quick_session',
        };
        const currentRecord = loadQuickRecord<Record<string, SchoolContent>>(
          QUICK_KEYS.SCHOOL_CONTENT,
          {}
        );
        const nextRecord = { ...currentRecord, [selectedSectionKey]: updatedSection };
        saveQuickRecord(QUICK_KEYS.SCHOOL_CONTENT, nextRecord);
        setContentDocs((prev) => ({ ...prev, [selectedSectionKey]: updatedSection }));
        appendQuickActivityLog({
          actorUid: userAccount?.uid,
          actorName: userAccount?.displayName || 'Admin',
          actorRole: effectiveRole,
          action: 'Perbarui Konten Web Profil',
          module: 'CMS Web Profil',
          details: `Menyimpan bagian ${selectedSectionKey}: ${sectionForm.title}`,
        });
        showToast('Konten profil sekolah berhasil diperbarui dan langsung tampil di website publik.');
        return;
      }

      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const ref = doc(db, 'school_content', selectedSectionKey);
      if (contentDocs[selectedSectionKey]) {
        await updateDoc(ref, {
          title: sectionForm.title.trim(),
          subtitle: sectionForm.subtitle.trim(),
          body: sectionForm.body.trim(),
          items: cleanedItems,
          updatedByUid: uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          sectionKey: selectedSectionKey,
          title: sectionForm.title.trim(),
          subtitle: sectionForm.subtitle.trim(),
          body: sectionForm.body.trim(),
          items: cleanedItems,
          updatedByUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await logActivity({
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Perbarui Konten Web Profil',
        module: 'CMS Web Profil',
        details: `Menyimpan bagian ${selectedSectionKey}: ${sectionForm.title}`,
      });
      showToast('Konten profil sekolah berhasil diperbarui dan langsung tampil di website publik.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `school_content/${selectedSectionKey}`);
    } finally {
      setSavingSection(false);
    }
  };

  const handleUploadSlotImage = async (slotKey: SiteVisualKey, file: File | null) => {
    if (!file) return;
    const slot = SITE_VISUAL_SLOTS.find((s) => s.key === slotKey);
    setVisualError(null);
    setUploadingKey(slotKey);
    try {
      const dataUrl = await compressImageFile(file, {
        maxWidth: slot?.maxWidth ?? 1200,
        maxHeight: slot?.maxHeight ?? 800,
        maxChars: 150000,
      });
      setVisualForm((prev) => ({
        ...prev,
        [slotKey]: {
          ...prev[slotKey],
          url: dataUrl,
        },
      }));
    } catch (err) {
      setVisualError(err instanceof Error ? err.message : 'Gagal memproses berkas gambar.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSaveVisuals = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canManageCms) return;
    setSavingVisuals(true);
    setVisualError(null);
    try {
      const items = SITE_VISUAL_SLOTS.map((slot) => ({
        label: slot.key,
        value: (visualForm[slot.key]?.url || '').trim(),
        description: (visualForm[slot.key]?.caption || slot.defaultCaption).trim(),
      }));

      if (isQuickSession) {
        const updatedVisuals: SchoolContent = {
          id: 'site_visuals',
          sectionKey: 'site_visuals',
          title: 'Pengaturan Gambar & Identitas Visual Sekolah',
          subtitle: 'Logo, Hero Kampus, Foto Kepala Sekolah, Banner Profil & PPDB',
          body: 'Konfigurasi gambar resmi website profil dan portal SIMS SMA Darul Ulum Kepohbaru.',
          items,
          updatedByUid: userAccount?.uid || 'quick_session',
        };
        const currentRecord = loadQuickRecord<Record<string, SchoolContent>>(
          QUICK_KEYS.SCHOOL_CONTENT,
          {}
        );
        saveQuickRecord(QUICK_KEYS.SCHOOL_CONTENT, {
          ...currentRecord,
          site_visuals: updatedVisuals,
        });
        setContentDocs((prev) => ({ ...prev, site_visuals: updatedVisuals }));
        appendQuickActivityLog({
          actorUid: userAccount?.uid,
          actorName: userAccount?.displayName || 'Admin',
          actorRole: effectiveRole,
          action: 'Perbarui Gambar Website',
          module: 'Kelola Gambar Website',
          details: 'Memperbarui konfigurasi visual/gambar resmi website dan portal SIMS.',
        });
        showToast('Seluruh perubahan gambar berhasil disimpan dan langsung diperbarui di website.');
        return;
      }

      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const ref = doc(db, 'school_content', 'site_visuals');
      if (contentDocs.site_visuals) {
        await updateDoc(ref, {
          title: 'Pengaturan Gambar & Identitas Visual Sekolah',
          subtitle: 'Logo, Hero Kampus, Foto Kepala Sekolah, Banner Profil & PPDB',
          body: 'Konfigurasi gambar resmi website profil dan portal SIMS SMA Darul Ulum Kepohbaru.',
          items,
          updatedByUid: uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          sectionKey: 'site_visuals',
          title: 'Pengaturan Gambar & Identitas Visual Sekolah',
          subtitle: 'Logo, Hero Kampus, Foto Kepala Sekolah, Banner Profil & PPDB',
          body: 'Konfigurasi gambar resmi website profil dan portal SIMS SMA Darul Ulum Kepohbaru.',
          items,
          updatedByUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await logActivity({
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Perbarui Gambar Website',
        module: 'Kelola Gambar Website',
        details: 'Memperbarui konfigurasi visual/gambar resmi website dan portal SIMS.',
      });
      showToast('Seluruh perubahan gambar berhasil disimpan dan langsung diperbarui di website.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'school_content/site_visuals');
    } finally {
      setSavingVisuals(false);
    }
  };

  const handleUploadInlineImage = async (
    targetKey: string,
    file: File | null,
    onResult: (dataUrl: string) => void
  ) => {
    if (!file) return;
    setVisualError(null);
    setUploadingKey(targetKey);
    try {
      const dataUrl = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 800,
        maxChars: 350000,
      });
      onResult(dataUrl);
    } catch (err) {
      setVisualError(err instanceof Error ? err.message : 'Gagal memproses berkas gambar.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSaveTargetImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImageTarget || !canManageCms) return;
    setSavingTargetImage(true);
    try {
      if (isQuickSession) {
        if (editingImageTarget.collection === 'news') {
          const nextNews = news.map((n) =>
            n.id === editingImageTarget.id ? { ...n, imageUrl: editingImageTarget.url.trim() } : n
          );
          setNews(nextNews);
          saveQuickData(QUICK_KEYS.NEWS, nextNews);
        } else {
          const nextGallery = gallery.map((g) =>
            g.id === editingImageTarget.id ? { ...g, mediaUrl: editingImageTarget.url.trim() } : g
          );
          setGallery(nextGallery);
          saveQuickData(QUICK_KEYS.GALLERY, nextGallery);
        }
        appendQuickActivityLog({
          actorUid: userAccount?.uid,
          actorName: userAccount?.displayName || 'Admin',
          actorRole: effectiveRole,
          action: 'Ubah Gambar Konten',
          module: 'Kelola Gambar Website',
          details: `Memperbarui gambar untuk "${editingImageTarget.title}" (${editingImageTarget.collection}).`,
        });
        showToast(`Gambar "${editingImageTarget.title}" berhasil diperbarui.`);
        setEditingImageTarget(null);
        return;
      }

      const ref = doc(db, editingImageTarget.collection, editingImageTarget.id);
      if (editingImageTarget.collection === 'news') {
        await updateDoc(ref, {
          imageUrl: editingImageTarget.url.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          mediaUrl: editingImageTarget.url.trim(),
          updatedAt: serverTimestamp(),
        });
      }
      await logActivity({
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Ubah Gambar Konten',
        module: 'Kelola Gambar Website',
        details: `Memperbarui gambar untuk "${editingImageTarget.title}" (${editingImageTarget.collection}).`,
      });
      showToast(`Gambar "${editingImageTarget.title}" berhasil diperbarui.`);
      setEditingImageTarget(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `${editingImageTarget.collection}/${editingImageTarget.id}`
      );
    } finally {
      setSavingTargetImage(false);
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCms || !newsForm.title.trim() || !newsForm.summary.trim()) return;
    if (isQuickSession) {
      const created: NewsArticle = {
        id: nextQuickId('news'),
        title: newsForm.title.trim(),
        category: newsForm.category.trim(),
        summary: newsForm.summary.trim(),
        content: (newsForm.content || newsForm.summary).trim(),
        imageUrl: newsForm.imageUrl.trim(),
        publishedDate: newsForm.publishedDate,
        authorName: userAccount?.displayName || 'Tim Humas',
        isPublished: true,
        authorUid: userAccount?.uid || 'quick_session',
      };
      const next = [created, ...news].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
      setNews(next);
      saveQuickData(QUICK_KEYS.NEWS, next);
      appendQuickActivityLog({
        actorUid: userAccount?.uid,
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Publikasi Berita Sekolah',
        module: 'CMS Web Profil',
        details: `Menerbitkan berita "${newsForm.title.trim()}".`,
      });
      setNewsForm({
        title: '',
        category: 'Akademik',
        summary: '',
        content: '',
        imageUrl: '',
        publishedDate: new Date().toISOString().slice(0, 10),
      });
      showToast('Berita sekolah berhasil dipublikasikan.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addDoc(collection(db, 'news'), {
        title: newsForm.title.trim(),
        category: newsForm.category.trim(),
        summary: newsForm.summary.trim(),
        content: (newsForm.content || newsForm.summary).trim(),
        imageUrl: newsForm.imageUrl.trim(),
        publishedDate: newsForm.publishedDate,
        authorName: userAccount?.displayName || 'Tim Humas',
        isPublished: true,
        authorUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Publikasi Berita Sekolah',
        module: 'CMS Web Profil',
        details: `Menerbitkan berita "${newsForm.title.trim()}".`,
      });
      setNewsForm({
        title: '',
        category: 'Akademik',
        summary: '',
        content: '',
        imageUrl: '',
        publishedDate: new Date().toISOString().slice(0, 10),
      });
      showToast('Berita sekolah berhasil dipublikasikan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'news');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCms || !annForm.title.trim() || !annForm.content.trim()) return;
    if (isQuickSession) {
      const created: Announcement = {
        id: nextQuickId('ann'),
        title: annForm.title.trim(),
        content: annForm.content.trim(),
        audience: annForm.audience,
        priority: annForm.priority,
        publishedDate: annForm.publishedDate,
        authorUid: userAccount?.uid || 'quick_session',
        authorName: userAccount?.displayName || 'Sekretariat',
      };
      const next = [created, ...announcements].sort((a, b) =>
        b.publishedDate.localeCompare(a.publishedDate)
      );
      setAnnouncements(next);
      saveQuickData(QUICK_KEYS.ANNOUNCEMENTS, next);
      appendQuickActivityLog({
        actorUid: userAccount?.uid,
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Buat Pengumuman',
        module: 'CMS Web Profil',
        details: `Mempublikasikan pengumuman "${annForm.title.trim()}" untuk ${annForm.audience}.`,
      });
      setAnnForm({
        title: '',
        content: '',
        audience: 'publik',
        priority: 'normal',
        publishedDate: new Date().toISOString().slice(0, 10),
      });
      showToast('Pengumuman berhasil disimpan.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        title: annForm.title.trim(),
        content: annForm.content.trim(),
        audience: annForm.audience,
        priority: annForm.priority,
        publishedDate: annForm.publishedDate,
        authorUid: uid,
        authorName: userAccount?.displayName || 'Sekretariat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Buat Pengumuman',
        module: 'CMS Web Profil',
        details: `Mempublikasikan pengumuman "${annForm.title.trim()}" untuk ${annForm.audience}.`,
      });
      setAnnForm({
        title: '',
        content: '',
        audience: 'publik',
        priority: 'normal',
        publishedDate: new Date().toISOString().slice(0, 10),
      });
      showToast('Pengumuman berhasil disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'announcements');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCms || !eventForm.title.trim()) return;
    if (isQuickSession) {
      const created: AcademicEvent = {
        id: nextQuickId('ev'),
        title: eventForm.title.trim(),
        startDate: eventForm.startDate,
        endDate: eventForm.endDate,
        category: eventForm.category.trim(),
        description: eventForm.description.trim(),
        authorUid: userAccount?.uid || 'quick_session',
      };
      const next = [...events, created].sort((a, b) => a.startDate.localeCompare(b.startDate));
      setEvents(next);
      saveQuickData(QUICK_KEYS.EVENTS, next);
      setEventForm({
        title: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        category: 'Akademik',
        description: '',
      });
      showToast('Agenda kalender akademik berhasil ditambahkan.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addDoc(collection(db, 'academic_events'), {
        title: eventForm.title.trim(),
        startDate: eventForm.startDate,
        endDate: eventForm.endDate,
        category: eventForm.category.trim(),
        description: eventForm.description.trim(),
        authorUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEventForm({
        title: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        category: 'Akademik',
        description: '',
      });
      showToast('Agenda kalender akademik berhasil ditambahkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'academic_events');
    }
  };

  const handleCreateAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCms || !achForm.title.trim() || !achForm.recipientName.trim()) return;
    if (isQuickSession) {
      const created: Achievement = {
        id: nextQuickId('ach'),
        title: achForm.title.trim(),
        recipientName: achForm.recipientName.trim(),
        level: achForm.level,
        year: achForm.year.trim(),
        category: achForm.category.trim(),
        description: achForm.description.trim(),
        authorUid: userAccount?.uid || 'quick_session',
      };
      const next = [created, ...achievements];
      setAchievements(next);
      saveQuickData(QUICK_KEYS.ACHIEVEMENTS, next);
      setAchForm({
        title: '',
        recipientName: '',
        level: 'Kabupaten',
        year: '2026',
        category: 'Akademik',
        description: '',
      });
      showToast('Data prestasi siswa/sekolah berhasil ditambahkan.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addDoc(collection(db, 'achievements'), {
        title: achForm.title.trim(),
        recipientName: achForm.recipientName.trim(),
        level: achForm.level,
        year: achForm.year.trim(),
        category: achForm.category.trim(),
        description: achForm.description.trim(),
        authorUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAchForm({
        title: '',
        recipientName: '',
        level: 'Kabupaten',
        year: '2026',
        category: 'Akademik',
        description: '',
      });
      showToast('Data prestasi siswa/sekolah berhasil ditambahkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'achievements');
    }
  };

  const handleCreateGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCms || !galForm.title.trim() || !galForm.caption.trim()) return;
    if (isQuickSession) {
      const created: GalleryItem = {
        id: nextQuickId('gal'),
        title: galForm.title.trim(),
        mediaType: galForm.mediaType,
        category: galForm.category.trim(),
        caption: galForm.caption.trim(),
        mediaUrl: galForm.mediaUrl.trim(),
        eventDate: galForm.eventDate,
        authorUid: userAccount?.uid || 'quick_session',
      };
      const next = [created, ...gallery];
      setGallery(next);
      saveQuickData(QUICK_KEYS.GALLERY, next);
      setGalForm({
        title: '',
        mediaType: 'foto',
        category: 'Kegiatan Sekolah',
        caption: '',
        mediaUrl: '',
        eventDate: new Date().toISOString().slice(0, 10),
      });
      showToast('Item galeri berhasil ditambahkan.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addDoc(collection(db, 'gallery_items'), {
        title: galForm.title.trim(),
        mediaType: galForm.mediaType,
        category: galForm.category.trim(),
        caption: galForm.caption.trim(),
        mediaUrl: galForm.mediaUrl.trim(),
        eventDate: galForm.eventDate,
        authorUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setGalForm({
        title: '',
        mediaType: 'foto',
        category: 'Kegiatan Sekolah',
        caption: '',
        mediaUrl: '',
        eventDate: new Date().toISOString().slice(0, 10),
      });
      showToast('Item galeri berhasil ditambahkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'gallery_items');
    }
  };

  const handleCreateDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCms || !dirForm.name.trim() || !dirForm.position.trim()) return;
    if (isQuickSession) {
      const created: PublicDirectoryEntry = {
        id: nextQuickId('dir'),
        name: dirForm.name.trim(),
        roleType: dirForm.roleType,
        position: dirForm.position.trim(),
        subject: dirForm.subject.trim(),
        education: dirForm.education.trim(),
        authorUid: userAccount?.uid || 'quick_session',
      };
      const next = [...directory, created];
      setDirectory(next);
      saveQuickData(QUICK_KEYS.DIRECTORY, next);
      setDirForm({ name: '', roleType: 'guru', position: '', subject: '', education: '' });
      showToast('Entri direktori guru/tendik publik berhasil ditambahkan.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addDoc(collection(db, 'public_directory'), {
        name: dirForm.name.trim(),
        roleType: dirForm.roleType,
        position: dirForm.position.trim(),
        subject: dirForm.subject.trim(),
        education: dirForm.education.trim(),
        authorUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDirForm({ name: '', roleType: 'guru', position: '', subject: '', education: '' });
      showToast('Entri direktori guru/tendik publik berhasil ditambahkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'public_directory');
    }
  };

  const handleDeleteDoc = async (colName: string, id: string, label: string) => {
    if (isQuickSession) {
      if (colName === 'news') {
        const next = news.filter((item) => item.id !== id);
        setNews(next);
        saveQuickData(QUICK_KEYS.NEWS, next);
      } else if (colName === 'announcements') {
        const next = announcements.filter((item) => item.id !== id);
        setAnnouncements(next);
        saveQuickData(QUICK_KEYS.ANNOUNCEMENTS, next);
      } else if (colName === 'academic_events') {
        const next = events.filter((item) => item.id !== id);
        setEvents(next);
        saveQuickData(QUICK_KEYS.EVENTS, next);
      } else if (colName === 'achievements') {
        const next = achievements.filter((item) => item.id !== id);
        setAchievements(next);
        saveQuickData(QUICK_KEYS.ACHIEVEMENTS, next);
      } else if (colName === 'gallery_items') {
        const next = gallery.filter((item) => item.id !== id);
        setGallery(next);
        saveQuickData(QUICK_KEYS.GALLERY, next);
      } else if (colName === 'public_directory') {
        const next = directory.filter((item) => item.id !== id);
        setDirectory(next);
        saveQuickData(QUICK_KEYS.DIRECTORY, next);
      }
      appendQuickActivityLog({
        actorUid: userAccount?.uid,
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Hapus Item CMS',
        module: 'CMS Web Profil',
        details: `Menghapus "${label}" dari koleksi ${colName}.`,
      });
      showToast(`"${label}" dihapus.`);
      return;
    }

    try {
      await deleteDoc(doc(db, colName, id));
      await logActivity({
        actorName: userAccount?.displayName || 'Admin',
        actorRole: effectiveRole,
        action: 'Hapus Item CMS',
        module: 'CMS Web Profil',
        details: `Menghapus "${label}" dari koleksi ${colName}.`,
      });
      showToast(`"${label}" dihapus.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${colName}/${id}`);
    }
  };

  const handleUpdateUserRole = async (targetUser: UserAccount, newRole: UserRole) => {
    if (!isRealAdmin) return;
    if (isQuickSession) {
      const next = users.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u));
      setUsers(next);
      saveQuickData('sims_quick_users', next);
      appendQuickActivityLog({
        actorUid: userAccount?.uid,
        actorName: userAccount?.displayName || 'Super Admin',
        actorRole: 'super_admin',
        action: 'Ubah Peran Pengguna',
        module: 'Manajemen Akun & RBAC',
        details: `Peran ${targetUser.email} diubah menjadi ${ROLE_LABELS[newRole]}.`,
      });
      showToast(`Peran ${targetUser.displayName} diperbarui ke ${ROLE_LABELS[newRole]}.`);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', targetUser.id), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount?.displayName || 'Super Admin',
        actorRole: 'super_admin',
        action: 'Ubah Peran Pengguna',
        module: 'Manajemen Akun & RBAC',
        details: `Peran ${targetUser.email} diubah menjadi ${ROLE_LABELS[newRole]}.`,
      });
      showToast(`Peran ${targetUser.displayName} diperbarui ke ${ROLE_LABELS[newRole]}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    }
  };

  const handleToggleUserStatus = async (targetUser: UserAccount) => {
    if (!isRealAdmin) return;
    const nextStatus: UserAccount['activeStatus'] =
      targetUser.activeStatus === 'aktif' ? 'nonaktif' : 'aktif';
    if (isQuickSession) {
      const next = users.map((u) =>
        u.id === targetUser.id ? { ...u, activeStatus: nextStatus } : u
      );
      setUsers(next);
      saveQuickData('sims_quick_users', next);
      appendQuickActivityLog({
        actorUid: userAccount?.uid,
        actorName: userAccount?.displayName || 'Super Admin',
        actorRole: 'super_admin',
        action: 'Ubah Status Akun',
        module: 'Manajemen Akun & RBAC',
        details: `Status akun ${targetUser.email} diubah menjadi ${nextStatus}.`,
      });
      showToast(`Status akun ${targetUser.displayName} kini ${nextStatus}.`);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', targetUser.id), {
        activeStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        actorName: userAccount?.displayName || 'Super Admin',
        actorRole: 'super_admin',
        action: 'Ubah Status Akun',
        module: 'Manajemen Akun & RBAC',
        details: `Status akun ${targetUser.email} diubah menjadi ${nextStatus}.`,
      });
      showToast(`Status akun ${targetUser.displayName} kini ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    }
  };

  const handleRunSeed = async () => {
    if (!isRealAdmin) return;
    setSeeding(true);
    try {
      if (isQuickSession) {
        Object.values(QUICK_KEYS).forEach((key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            // ignore
          }
        });
        try {
          localStorage.removeItem('sims_quick_users');
        } catch {
          // ignore
        }
        const defaultQuickUsers: UserAccount[] = QUICK_ACCOUNTS.map((q) => ({
          id: q.id,
          uid: q.uid,
          email: q.email,
          displayName: q.displayName,
          role: q.role,
          activeStatus: 'aktif',
        }));
        setUsers(defaultQuickUsers);
        setLogs(DEFAULT_QUICK_ACTIVITY_LOGS);
        appendQuickActivityLog({
          actorUid: userAccount?.uid,
          actorName: userAccount?.displayName || 'Super Administrator',
          actorRole: 'super_admin',
          action: 'Pemulihan Data Master Lokal',
          module: 'Sistem Inti',
          details: 'Memulihkan seluruh data master lokal pada sesi akun langsung.',
        });
        showToast('Seluruh data master lokal pada sesi akun langsung telah dipulihkan ke bawaan.');
        return;
      }
      const res = await seedInitialDatabase(userAccount?.displayName || 'Super Administrator');
      showToast(res.message);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Gagal memulihkan/mengisi data awal.');
    } finally {
      setSeeding(false);
    }
  };

  const handleExportLogsExcel = () => {
    const rows = filteredLogs.map((l) => ({
      Aktor: l.actorName,
      Peran: l.actorRole,
      Modul: l.module,
      Aksi: l.action,
      Rincian: l.details,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log Aktivitas');
    XLSX.writeFile(wb, 'Log_Aktivitas_SIMS_SMADU.xlsx');
  };

  const filteredLogs = logs.filter((l) => {
    const matchMod = logModuleFilter === 'semua' || l.module === logModuleFilter;
    const q = logSearch.trim().toLowerCase();
    const matchText =
      !q ||
      l.actorName.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q);
    return matchMod && matchText;
  });

  const uniqueModules = Array.from(new Set(logs.map((l) => l.module)));

  if (mode === 'users_audit') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-editorial font-semibold text-slate-950">
              Manajemen Akun, RBAC & Audit Log
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Pengaturan kewenangan 7 peran pengguna SIMS, riwayat aktivitas sistem, dan pemulihan data awal.
            </p>
          </div>
          {isRealAdmin && (
            <button
              type="button"
              onClick={handleRunSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Database className="w-4 h-4" />
              {seeding ? 'Memproses...' : 'Inisialisasi / Pemulihan Data Master'}
            </button>
          )}
        </div>

        {statusMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-4 py-3 rounded-lg">
            {statusMessage}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          {isRealAdmin && (
            <button
              type="button"
              onClick={() => setAdminTab('users')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                adminTab === 'users'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" /> Akun & Hak Akses ({users.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setAdminTab('audit')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              adminTab === 'audit'
                ? 'bg-emerald-800 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-4 h-4" /> Log Aktivitas Sistem ({logs.length})
          </button>
        </div>

        {adminTab === 'users' && isRealAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-950">
                Daftar Akun Pengguna Terdaftar (RBAC 7 Peran)
              </h2>
              <span className="text-xs text-slate-500">
                Setiap pengguna baru via Google Sign-In otomatis masuk sebagai Orang Tua hingga dinaikkan oleh Super Admin.
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Nama Pengguna</th>
                    <th className="py-3 px-4 font-semibold">Email Google</th>
                    <th className="py-3 px-4 font-semibold">Peran RBAC</th>
                    <th className="py-3 px-4 font-semibold">Status Akun</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{u.displayName}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs font-mono">{u.email}</td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u, e.target.value as UserRole)}
                          className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                        >
                          {(Object.keys(ROLE_LABELS) as UserRole[]).map((roleKey) => (
                            <option key={roleKey} value={roleKey}>
                              {ROLE_LABELS[roleKey]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            u.activeStatus === 'aktif' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {u.activeStatus === 'aktif' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          disabled={u.uid === userAccount?.uid}
                          className="px-3 py-1 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                        >
                          {u.activeStatus === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(adminTab === 'audit' || !isRealAdmin) && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Cari aktor, aksi, atau rincian..."
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg w-64"
                />
                <select
                  value={logModuleFilter}
                  onChange={(e) => setLogModuleFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="semua">Semua Modul</option>
                  {uniqueModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleExportLogsExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Ekspor Log Excel
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Pengguna</th>
                    <th className="py-2.5 px-4 font-semibold">Peran</th>
                    <th className="py-2.5 px-4 font-semibold">Modul</th>
                    <th className="py-2.5 px-4 font-semibold">Aksi</th>
                    <th className="py-2.5 px-4 font-semibold">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Belum ada catatan log aktivitas yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.slice(0, 60).map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-medium text-slate-900">{l.actorName}</td>
                        <td className="py-2.5 px-4 text-xs text-slate-600">{l.actorRole}</td>
                        <td className="py-2.5 px-4 text-xs font-medium text-emerald-900">{l.module}</td>
                        <td className="py-2.5 px-4 text-xs font-semibold text-slate-800">{l.action}</td>
                        <td className="py-2.5 px-4 text-xs text-slate-600">{l.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // CMS Mode
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-editorial font-semibold text-slate-950">
          Manajemen Konten Web Profil Sekolah (CMS)
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Kelola seluruh 14 fitur website publik SMA Darul Ulum Kepohbaru secara dinamis tanpa mengubah kode program.
        </p>
      </div>

      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-4 py-3 rounded-lg">
          {statusMessage}
        </div>
      )}

      {!canManageCms && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3 rounded-lg">
          Mode baca saja: hanya Super Administrator dan Tenaga Kependidikan yang dapat mengubah konten CMS publik.
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setCmsTab('profil')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
            cmsTab === 'profil'
              ? 'bg-emerald-800 text-white'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" /> Profil, Visi Misi, PPDB & Kontak
        </button>
        <button
          type="button"
          onClick={() => setCmsTab('gambar')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
            cmsTab === 'gambar'
              ? 'bg-emerald-800 text-white'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Image className="w-4 h-4" /> Kelola Gambar Website
        </button>
        <button
          type="button"
          onClick={() => setCmsTab('berita_pengumuman')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
            cmsTab === 'berita_pengumuman'
              ? 'bg-emerald-800 text-white'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Newspaper className="w-4 h-4" /> Berita & Pengumuman
        </button>
        <button
          type="button"
          onClick={() => setCmsTab('kalender_prestasi')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
            cmsTab === 'kalender_prestasi'
              ? 'bg-emerald-800 text-white'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Award className="w-4 h-4" /> Kalender, Prestasi & Galeri
        </button>
        <button
          type="button"
          onClick={() => setCmsTab('direktori')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
            cmsTab === 'direktori'
              ? 'bg-emerald-800 text-white'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" /> Direktori GTK Publik
        </button>
      </div>

      {visualError && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-lg flex items-center justify-between gap-2">
          <span>{visualError}</span>
          <button type="button" onClick={() => setVisualError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {cmsTab === 'gambar' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveVisuals}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Pengaturan Gambar Utama Website & Portal SIMS
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unggah foto dari komputer/HP (otomatis dikompres) atau tempel tautan URL gambar.
                  Kosongkan untuk menggunakan ilustrasi bawaan.
                </p>
              </div>
              {canManageCms && (
                <button
                  type="submit"
                  disabled={savingVisuals}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <Save className="w-4 h-4" />
                  {savingVisuals ? 'Menyimpan...' : 'Simpan Semua Gambar'}
                </button>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {SITE_VISUAL_SLOTS.map((slot) => {
                const entry = visualForm[slot.key] || { url: '', caption: slot.defaultCaption };
                const hasImage = isRenderableImageUrl(entry.url);
                const isSquare =
                  slot.key === 'logo_sekolah' || slot.key === 'foto_kepala_sekolah';

                return (
                  <div
                    key={slot.key}
                    className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{slot.label}</h3>
                        <p className="text-[11px] text-slate-500">{slot.locationHint}</p>
                        <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                          {slot.recommendedSize}
                        </p>
                      </div>
                      {canManageCms && hasImage && (
                        <button
                          type="button"
                          onClick={() =>
                            setVisualForm((prev) => ({
                              ...prev,
                              [slot.key]: { ...prev[slot.key], url: '' },
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-300 bg-white rounded-md hover:bg-slate-100 shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" /> Bawaan
                        </button>
                      )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-center min-h-[140px]">
                      {hasImage ? (
                        <img
                          src={entry.url}
                          alt={entry.caption || slot.label}
                          className={
                            isSquare
                              ? 'w-28 h-28 rounded-xl object-cover border border-slate-200'
                              : 'w-full aspect-[16/9] max-h-44 rounded-lg object-cover'
                          }
                        />
                      ) : (
                        <div className="text-center space-y-1 py-4">
                          <Image className="w-7 h-7 text-slate-300 mx-auto" />
                          <div className="text-xs text-slate-500">
                            Menggunakan visual bawaan sistem
                          </div>
                        </div>
                      )}
                    </div>

                    {canManageCms && (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />
                            {uploadingKey === slot.key ? 'Mengolah Gambar...' : 'Unggah Gambar'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              className="hidden"
                              disabled={uploadingKey === slot.key}
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                handleUploadSlotImage(slot.key, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <span className="text-[11px] text-slate-500">
                            atau masukkan URL gambar di bawah
                          </span>
                        </div>

                        <input
                          type="text"
                          value={entry.url.startsWith('data:image/') ? '' : entry.url}
                          onChange={(e) =>
                            setVisualForm((prev) => ({
                              ...prev,
                              [slot.key]: { ...prev[slot.key], url: e.target.value },
                            }))
                          }
                          placeholder={
                            entry.url.startsWith('data:image/')
                              ? 'Gambar unggahan tersimpan (isi URL jika ingin mengganti dengan tautan)'
                              : 'https://contoh.sch.id/gambar.jpg'
                          }
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />

                        <input
                          type="text"
                          value={entry.caption}
                          onChange={(e) =>
                            setVisualForm((prev) => ({
                              ...prev,
                              [slot.key]: { ...prev[slot.key], caption: e.target.value },
                            }))
                          }
                          placeholder="Keterangan / teks alternatif gambar..."
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </form>

          {/* Ubah Gambar Berita & Galeri Langsung */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">
                    Gambar Sampul Berita ({news.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Klik Ubah Gambar untuk mengganti foto sampul berita yang sudah terbit.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCmsTab('berita_pengumuman')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Tambah Berita →
                </button>
              </div>
              <div className="divide-y divide-slate-200">
                {news.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">Belum ada berita tersimpan.</p>
                ) : (
                  news.map((n) => (
                    <div key={n.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {isRenderableImageUrl(n.imageUrl) ? (
                          <img
                            src={n.imageUrl}
                            alt={n.title}
                            className="w-16 h-11 rounded-md object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-11 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Image className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {n.title}
                          </div>
                          <div className="text-[11px] text-slate-500 font-tabular">
                            {n.publishedDate} · {isRenderableImageUrl(n.imageUrl) ? 'Foto khusus' : 'Ilustrasi bawaan'}
                          </div>
                        </div>
                      </div>
                      {canManageCms && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingImageTarget({
                              collection: 'news',
                              id: n.id,
                              title: n.title,
                              url: n.imageUrl || '',
                            })
                          }
                          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 shrink-0"
                        >
                          Ubah Gambar
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">
                    Gambar Galeri Foto & Video ({gallery.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Klik Ubah Gambar untuk mengunggah atau mengganti foto dokumentasi galeri.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCmsTab('kalender_prestasi')}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Tambah Galeri →
                </button>
              </div>
              <div className="divide-y divide-slate-200">
                {gallery.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">Belum ada item galeri tersimpan.</p>
                ) : (
                  gallery.map((g) => (
                    <div key={g.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {isRenderableImageUrl(g.mediaUrl) ? (
                          <img
                            src={g.mediaUrl}
                            alt={g.title}
                            className="w-16 h-11 rounded-md object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-11 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Image className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {g.title}
                          </div>
                          <div className="text-[11px] text-slate-500 font-tabular">
                            {g.mediaType.toUpperCase()} · {g.eventDate} ·{' '}
                            {isRenderableImageUrl(g.mediaUrl) ? 'Foto terpasang' : 'Ilustrasi bawaan'}
                          </div>
                        </div>
                      </div>
                      {canManageCms && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingImageTarget({
                              collection: 'gallery_items',
                              id: g.id,
                              title: g.title,
                              url: g.mediaUrl || '',
                            })
                          }
                          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 shrink-0"
                        >
                          Ubah Gambar
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {cmsTab === 'profil' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            {SECTION_KEYS.map((sec) => (
              <button
                key={sec.key}
                type="button"
                onClick={() => setSelectedSectionKey(sec.key)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  selectedSectionKey === sec.key
                    ? 'bg-emerald-50 border-emerald-700 text-emerald-950 font-semibold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div>{sec.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {contentDocs[sec.key] ? 'Tersimpan di Cloud' : 'Menggunakan Bawaan Sistem'}
                </div>
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSaveSection}
            className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Bagian</label>
              <input
                type="text"
                required
                disabled={!canManageCms}
                value={sectionForm.title}
                onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subjudul</label>
              <input
                type="text"
                disabled={!canManageCms}
                value={sectionForm.subtitle}
                onChange={(e) => setSectionForm({ ...sectionForm, subtitle: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Narasi Utama</label>
              <textarea
                rows={4}
                required
                disabled={!canManageCms}
                value={sectionForm.body}
                onChange={(e) => setSectionForm({ ...sectionForm, body: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Poin Terstruktur ({sectionForm.items.length})
                </span>
                {canManageCms && (
                  <button
                    type="button"
                    onClick={() =>
                      setSectionForm({
                        ...sectionForm,
                        items: [...sectionForm.items, { label: '', value: '', description: '' }],
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Poin
                  </button>
                )}
              </div>
              {sectionForm.items.map((item, idx) => (
                <div key={idx} className="grid sm:grid-cols-12 gap-2 items-start bg-slate-50 p-3 rounded-lg">
                  <input
                    type="text"
                    disabled={!canManageCms}
                    placeholder="Label"
                    value={item.label}
                    onChange={(e) => {
                      const next = [...sectionForm.items];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setSectionForm({ ...sectionForm, items: next });
                    }}
                    className="sm:col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                  <input
                    type="text"
                    disabled={!canManageCms}
                    placeholder="Isi / Nilai"
                    value={item.value}
                    onChange={(e) => {
                      const next = [...sectionForm.items];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setSectionForm({ ...sectionForm, items: next });
                    }}
                    className="sm:col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                  <input
                    type="text"
                    disabled={!canManageCms}
                    placeholder="Keterangan"
                    value={item.description || ''}
                    onChange={(e) => {
                      const next = [...sectionForm.items];
                      next[idx] = { ...next[idx], description: e.target.value };
                      setSectionForm({ ...sectionForm, items: next });
                    }}
                    className="sm:col-span-3 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                  {canManageCms && (
                    <button
                      type="button"
                      onClick={() =>
                        setSectionForm({
                          ...sectionForm,
                          items: sectionForm.items.filter((_, i) => i !== idx),
                        })
                      }
                      className="sm:col-span-1 p-1.5 text-red-600 hover:bg-red-50 rounded"
                      aria-label="Hapus poin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canManageCms && (
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingSection}
                  className="px-5 py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900 disabled:opacity-60"
                >
                  {savingSection ? 'Menyimpan...' : 'Simpan & Publikasikan'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {cmsTab === 'berita_pengumuman' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Berita */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Newspaper className="w-4 h-4 text-emerald-800" /> Berita & Kegiatan Sekolah
            </div>
            {canManageCms && (
              <form onSubmit={handleCreateNews} className="space-y-3 border-b border-slate-200 pb-5">
                <input
                  type="text"
                  required
                  placeholder="Judul berita..."
                  value={newsForm.title}
                  onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Kategori (Akademik/Kesiswaan)"
                    value={newsForm.category}
                    onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="date"
                    required
                    value={newsForm.publishedDate}
                    onChange={(e) => setNewsForm({ ...newsForm, publishedDate: e.target.value })}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-tabular"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ringkasan singkat berita..."
                  value={newsForm.summary}
                  onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <textarea
                  rows={3}
                  placeholder="Isi artikel lengkap..."
                  value={newsForm.content}
                  onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">
                      Gambar Sampul Berita (Opsional)
                    </span>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingKey === 'new_news' ? 'Mengolah...' : 'Unggah Foto'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleUploadInlineImage('new_news', file, (url) =>
                            setNewsForm((prev) => ({ ...prev, imageUrl: url }))
                          );
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Atau tempel URL gambar berita (https://...)"
                    value={newsForm.imageUrl.startsWith('data:image/') ? '' : newsForm.imageUrl}
                    onChange={(e) => setNewsForm({ ...newsForm, imageUrl: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                  {isRenderableImageUrl(newsForm.imageUrl) && (
                    <div className="flex items-center justify-between gap-2">
                      <img
                        src={newsForm.imageUrl}
                        alt="Pratinjau sampul berita"
                        className="w-24 h-14 rounded object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setNewsForm({ ...newsForm, imageUrl: '' })}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Hapus Gambar
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900"
                >
                  Terbitkan Berita
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-200">
              {news.map((n) => (
                <div key={n.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {isRenderableImageUrl(n.imageUrl) && (
                      <img
                        src={n.imageUrl}
                        alt={n.title}
                        className="w-14 h-10 rounded object-cover border border-slate-200 shrink-0 mt-0.5"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 font-tabular">
                        {n.publishedDate} · {n.category}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                    </div>
                  </div>
                  {canManageCms && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingImageTarget({
                            collection: 'news',
                            id: n.id,
                            title: n.title,
                            url: n.imageUrl || '',
                          })
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold border border-slate-300 rounded hover:bg-slate-50"
                      >
                        Ubah Gambar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc('news', n.id, n.title)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pengumuman */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Megaphone className="w-4 h-4 text-emerald-800" /> Pengumuman Sekolah
            </div>
            {canManageCms && (
              <form
                onSubmit={handleCreateAnnouncement}
                className="space-y-3 border-b border-slate-200 pb-5"
              >
                <input
                  type="text"
                  required
                  placeholder="Judul pengumuman..."
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={annForm.audience}
                    onChange={(e) =>
                      setAnnForm({ ...annForm, audience: e.target.value as Announcement['audience'] })
                    }
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="publik">Publik</option>
                    <option value="orang_tua">Orang Tua</option>
                    <option value="guru">Guru & Staf</option>
                    <option value="semua">Semua</option>
                  </select>
                  <select
                    value={annForm.priority}
                    onChange={(e) =>
                      setAnnForm({ ...annForm, priority: e.target.value as Announcement['priority'] })
                    }
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="penting">Penting</option>
                  </select>
                  <input
                    type="date"
                    required
                    value={annForm.publishedDate}
                    onChange={(e) => setAnnForm({ ...annForm, publishedDate: e.target.value })}
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg font-tabular"
                  />
                </div>
                <textarea
                  rows={3}
                  required
                  placeholder="Isi pengumuman..."
                  value={annForm.content}
                  onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900"
                >
                  Simpan Pengumuman
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-200">
              {announcements.map((a) => (
                <div key={a.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 font-tabular">
                      {a.publishedDate} · {a.audience} · {a.priority}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                  </div>
                  {canManageCms && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc('announcements', a.id, a.title)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cmsTab === 'kalender_prestasi' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Kalender Akademik */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Calendar className="w-4 h-4 text-emerald-800" /> Kalender Akademik
            </div>
            {canManageCms && (
              <form onSubmit={handleCreateEvent} className="space-y-2.5 border-b border-slate-200 pb-4">
                <input
                  type="text"
                  required
                  placeholder="Nama agenda..."
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-tabular"
                  />
                  <input
                    type="date"
                    required
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-tabular"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Kategori (Ujian / Pembinaan)"
                  value={eventForm.category}
                  onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                >
                  Tambah Agenda
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-200">
              {events.map((ev) => (
                <div key={ev.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500 font-tabular">
                      {ev.startDate} s.d. {ev.endDate}
                    </div>
                    <div className="text-sm font-medium text-slate-900">{ev.title}</div>
                  </div>
                  {canManageCms && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc('academic_events', ev.id, ev.title)}
                      className="p-1 text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Prestasi */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Award className="w-4 h-4 text-amber-700" /> Prestasi Siswa & Sekolah
            </div>
            {canManageCms && (
              <form
                onSubmit={handleCreateAchievement}
                className="space-y-2.5 border-b border-slate-200 pb-4"
              >
                <input
                  type="text"
                  required
                  placeholder="Nama kejuaraan / prestasi..."
                  value={achForm.title}
                  onChange={(e) => setAchForm({ ...achForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Nama siswa / tim..."
                  value={achForm.recipientName}
                  onChange={(e) => setAchForm({ ...achForm, recipientName: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={achForm.level}
                    onChange={(e) =>
                      setAchForm({ ...achForm, level: e.target.value as Achievement['level'] })
                    }
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Kabupaten">Kabupaten</option>
                    <option value="Provinsi">Provinsi</option>
                    <option value="Nasional">Nasional</option>
                    <option value="Internasional">Internasional</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Tahun"
                    value={achForm.year}
                    onChange={(e) => setAchForm({ ...achForm, year: e.target.value })}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-tabular"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                >
                  Tambah Prestasi
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-200">
              {achievements.map((a) => (
                <div key={a.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-amber-700 font-semibold">
                      {a.level} · {a.year}
                    </div>
                    <div className="text-sm font-medium text-slate-900">{a.title}</div>
                    <div className="text-xs text-slate-500">{a.recipientName}</div>
                  </div>
                  {canManageCms && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc('achievements', a.id, a.title)}
                      className="p-1 text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Galeri */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Image className="w-4 h-4 text-emerald-800" /> Galeri Foto & Video
            </div>
            {canManageCms && (
              <form onSubmit={handleCreateGallery} className="space-y-2.5 border-b border-slate-200 pb-4">
                <input
                  type="text"
                  required
                  placeholder="Judul dokumentasi..."
                  value={galForm.title}
                  onChange={(e) => setGalForm({ ...galForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={galForm.mediaType}
                    onChange={(e) =>
                      setGalForm({
                        ...galForm,
                        mediaType: e.target.value as GalleryItem['mediaType'],
                      })
                    }
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="foto">Foto</option>
                    <option value="video">Video</option>
                  </select>
                  <input
                    type="date"
                    required
                    value={galForm.eventDate}
                    onChange={(e) => setGalForm({ ...galForm, eventDate: e.target.value })}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-tabular"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Keterangan / caption..."
                  value={galForm.caption}
                  onChange={(e) => setGalForm({ ...galForm, caption: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-700">
                      Foto / Gambar Dokumentasi
                    </span>
                    <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer">
                      <Upload className="w-3 h-3" />
                      {uploadingKey === 'new_gallery' ? 'Mengolah...' : 'Unggah'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleUploadInlineImage('new_gallery', file, (url) =>
                            setGalForm((prev) => ({ ...prev, mediaUrl: url }))
                          );
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Atau tempel URL foto/thumbnail..."
                    value={galForm.mediaUrl.startsWith('data:image/') ? '' : galForm.mediaUrl}
                    onChange={(e) => setGalForm({ ...galForm, mediaUrl: e.target.value })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded bg-white"
                  />
                  {isRenderableImageUrl(galForm.mediaUrl) && (
                    <div className="flex items-center justify-between gap-2">
                      <img
                        src={galForm.mediaUrl}
                        alt="Pratinjau galeri"
                        className="w-20 h-12 rounded object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setGalForm({ ...galForm, mediaUrl: '' })}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                >
                  Tambah ke Galeri
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-200">
              {gallery.map((g) => (
                <div key={g.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isRenderableImageUrl(g.mediaUrl) && (
                      <img
                        src={g.mediaUrl}
                        alt={g.title}
                        className="w-12 h-9 rounded object-cover border border-slate-200 shrink-0 mt-0.5"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 font-tabular">
                        {g.mediaType.toUpperCase()} · {g.eventDate}
                      </div>
                      <div className="text-sm font-medium text-slate-900">{g.title}</div>
                    </div>
                  </div>
                  {canManageCms && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingImageTarget({
                            collection: 'gallery_items',
                            id: g.id,
                            title: g.title,
                            url: g.mediaUrl || '',
                          })
                        }
                        className="px-2 py-1 text-[11px] font-semibold border border-slate-300 rounded hover:bg-slate-50"
                      >
                        Ubah Gambar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc('gallery_items', g.id, g.title)}
                        className="p-1 text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cmsTab === 'direktori' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Direktori Publik Guru, Pimpinan & Tenaga Kependidikan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar ini ditampilkan pada halaman Profil Website Sekolah (tanpa data pribadi sensitif).
            </p>
          </div>
          {canManageCms && (
            <form onSubmit={handleCreateDirectory} className="grid sm:grid-cols-5 gap-3">
              <input
                type="text"
                required
                placeholder="Nama & Gelar"
                value={dirForm.name}
                onChange={(e) => setDirForm({ ...dirForm, name: e.target.value })}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <select
                value={dirForm.roleType}
                onChange={(e) =>
                  setDirForm({
                    ...dirForm,
                    roleType: e.target.value as PublicDirectoryEntry['roleType'],
                  })
                }
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="pimpinan">Pimpinan</option>
                <option value="guru">Guru</option>
                <option value="tendik">Tendik</option>
              </select>
              <input
                type="text"
                required
                placeholder="Jabatan"
                value={dirForm.position}
                onChange={(e) => setDirForm({ ...dirForm, position: e.target.value })}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Mapel / Bidang"
                value={dirForm.subject}
                onChange={(e) => setDirForm({ ...dirForm, subject: e.target.value })}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900"
              >
                Tambah GTK Publik
              </button>
            </form>
          )}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Nama</th>
                  <th className="py-2.5 px-4 font-semibold">Kategori</th>
                  <th className="py-2.5 px-4 font-semibold">Jabatan</th>
                  <th className="py-2.5 px-4 font-semibold">Bidang / Mapel</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {directory.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{d.name}</td>
                    <td className="py-2.5 px-4 text-xs capitalize text-slate-600">{d.roleType}</td>
                    <td className="py-2.5 px-4 text-slate-700">{d.position}</td>
                    <td className="py-2.5 px-4 text-slate-600">{d.subject || '-'}</td>
                    <td className="py-2.5 px-4 text-right">
                      {canManageCms && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc('public_directory', d.id, d.name)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal Ubah Gambar Berita / Galeri */}
      {editingImageTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTargetImage}
            className="bg-white rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Ubah Gambar Konten</h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {editingImageTarget.title}
                </p>
              </div>
              <button type="button" onClick={() => setEditingImageTarget(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-center min-h-[160px]">
              {isRenderableImageUrl(editingImageTarget.url) ? (
                <img
                  src={editingImageTarget.url}
                  alt={editingImageTarget.title}
                  className="w-full aspect-[16/9] max-h-48 rounded-lg object-cover"
                />
              ) : (
                <div className="text-xs text-slate-500 text-center">
                  Belum ada gambar khusus (menggunakan ilustrasi bawaan)
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {uploadingKey === 'modal_target' ? 'Mengolah...' : 'Unggah Gambar Baru'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleUploadInlineImage('modal_target', file, (url) =>
                      setEditingImageTarget((prev) => (prev ? { ...prev, url } : null))
                    );
                    e.target.value = '';
                  }}
                />
              </label>
              {isRenderableImageUrl(editingImageTarget.url) && (
                <button
                  type="button"
                  onClick={() =>
                    setEditingImageTarget((prev) => (prev ? { ...prev, url: '' } : null))
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Hapus / Bawaan
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Atau Tempel URL Gambar
              </label>
              <input
                type="text"
                value={
                  editingImageTarget.url.startsWith('data:image/') ? '' : editingImageTarget.url
                }
                onChange={(e) =>
                  setEditingImageTarget((prev) =>
                    prev ? { ...prev, url: e.target.value } : null
                  )
                }
                placeholder={
                  editingImageTarget.url.startsWith('data:image/')
                    ? 'Gambar unggahan siap disimpan'
                    : 'https://contoh.sch.id/foto.jpg'
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingImageTarget(null)}
                className="px-4 py-2 text-xs border border-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingTargetImage}
                className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 disabled:opacity-60"
              >
                {savingTargetImage ? 'Menyimpan...' : 'Simpan Gambar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
