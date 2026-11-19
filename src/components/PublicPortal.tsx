import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Mail,
  MapPin,
  Menu,
  Phone,
  Search,
  X,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_ANNOUNCEMENTS,
  DEFAULT_EVENTS,
  DEFAULT_GALLERY,
  DEFAULT_NEWS,
  DEFAULT_PUBLIC_DIRECTORY,
  DEFAULT_PUBLIC_PROFILE,
} from '../lib/seedData';
import type {
  AcademicEvent,
  Achievement,
  Announcement,
  GalleryItem,
  NewsArticle,
  PublicDirectoryEntry,
  SchoolContent,
} from '../types/sims';
import { isRenderableImageUrl, parseSiteVisuals } from '../lib/imageUtils';
import { CampusHeroVisual, EditorialCardVisual, PrincipalAvatarVisual } from './SchoolVisuals';

type PublicTab = 'beranda' | 'profil' | 'akademik' | 'kabar' | 'ppdb_kontak';

interface PublicPortalProps {
  onOpenPortal: () => void;
  isAuthenticated: boolean;
}

export function PublicPortal({ onOpenPortal, isAuthenticated }: PublicPortalProps) {
  const [activeTab, setActiveTab] = useState<PublicTab>('beranda');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [contents, setContents] = useState<Record<string, Omit<SchoolContent, 'id' | 'updatedByUid'>>>(
    DEFAULT_PUBLIC_PROFILE
  );
  const [news, setNews] = useState<NewsArticle[]>(
    DEFAULT_NEWS.map((n, i) => ({ ...n, id: `def_n_${i}`, authorUid: 'system' }))
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    DEFAULT_ANNOUNCEMENTS.filter((a) => a.audience === 'publik').map((a, i) => ({
      ...a,
      id: `def_a_${i}`,
      authorUid: 'system',
    }))
  );
  const [events, setEvents] = useState<AcademicEvent[]>(
    DEFAULT_EVENTS.map((e, i) => ({ ...e, id: `def_e_${i}`, authorUid: 'system' }))
  );
  const [achievements, setAchievements] = useState<Achievement[]>(
    DEFAULT_ACHIEVEMENTS.map((ac, i) => ({ ...ac, id: `def_ac_${i}`, authorUid: 'system' }))
  );
  const [gallery, setGallery] = useState<GalleryItem[]>(
    DEFAULT_GALLERY.map((g, i) => ({ ...g, id: `def_g_${i}`, authorUid: 'system' }))
  );
  const [directory, setDirectory] = useState<PublicDirectoryEntry[]>(
    DEFAULT_PUBLIC_DIRECTORY.map((d, i) => ({ ...d, id: `def_d_${i}`, authorUid: 'system' }))
  );

  const [dirFilter, setDirFilter] = useState<'semua' | 'pimpinan' | 'guru' | 'tendik'>('semua');
  const [dirSearch, setDirSearch] = useState('');
  const [selectedNews, setSelectedNews] = useState<NewsArticle | null>(null);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ name: '', contact: '', topic: 'Informasi PPDB', message: '' });

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'school_content'),
        (snap) => {
          if (!snap.empty) {
            const map: Record<string, Omit<SchoolContent, 'id' | 'updatedByUid'>> = {
              ...DEFAULT_PUBLIC_PROFILE,
            };
            snap.forEach((d) => {
              const data = d.data() as SchoolContent;
              map[d.id] = data;
            });
            setContents(map);
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'news'),
        (snap) => {
          if (!snap.empty) {
            const items = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<NewsArticle, 'id'>) }))
              .filter((n) => n.isPublished)
              .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
            if (items.length > 0) setNews(items);
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'announcements'),
        (snap) => {
          if (!snap.empty) {
            const items = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
              .filter((a) => a.audience === 'publik' || a.audience === 'semua')
              .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
            if (items.length > 0) setAnnouncements(items);
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'academic_events'),
        (snap) => {
          if (!snap.empty) {
            setEvents(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicEvent, 'id'>) }))
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
            );
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'achievements'),
        (snap) => {
          if (!snap.empty) {
            setAchievements(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Achievement, 'id'>) }))
            );
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'gallery_items'),
        (snap) => {
          if (!snap.empty) {
            setGallery(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GalleryItem, 'id'>) }))
            );
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'public_directory'),
        (snap) => {
          if (!snap.empty) {
            setDirectory(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicDirectoryEntry, 'id'>) }))
            );
          }
        },
        () => {}
      )
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  const navItems: Array<{ key: PublicTab; label: string }> = [
    { key: 'beranda', label: 'Beranda' },
    { key: 'profil', label: 'Profil' },
    { key: 'akademik', label: 'Akademik' },
    { key: 'kabar', label: 'Kabar & Agenda' },
    { key: 'ppdb_kontak', label: 'PPDB & Kontak' },
  ];

  const handleNav = (tab: PublicTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredDirectory = directory.filter((entry) => {
    const matchRole = dirFilter === 'semua' || entry.roleType === dirFilter;
    const q = dirSearch.trim().toLowerCase();
    const matchText =
      !q ||
      entry.name.toLowerCase().includes(q) ||
      entry.position.toLowerCase().includes(q) ||
      (entry.subject || '').toLowerCase().includes(q);
    return matchRole && matchText;
  });

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryForm.name.trim() || !inquiryForm.message.trim()) return;
    setInquirySubmitted(true);
    setInquiryForm({ name: '', contact: '', topic: 'Informasi PPDB', message: '' });
  };

  const visuals = parseSiteVisuals(contents.site_visuals);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 Zones Separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => handleNav('beranda')}
            className="flex items-center gap-2.5 text-lg font-editorial font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0 text-left"
          >
            {isRenderableImageUrl(visuals.logo_sekolah.url) && (
              <img
                src={visuals.logo_sekolah.url}
                alt={visuals.logo_sekolah.caption || 'Logo SMA Darul Ulum Kepohbaru'}
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            )}
            <span>SMA Darul Ulum Kepohbaru</span>
          </button>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNav(item.key)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  activeTab === item.key
                    ? 'border-emerald-800 text-emerald-950 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenPortal}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
            >
              {isAuthenticated ? 'Buka Dashboard' : 'Portal SIMS'}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Menu navigasi"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-6 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNav(item.key)}
                className={`text-left py-2.5 text-sm font-medium rounded-lg px-3 ${
                  activeTab === item.key ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'beranda' && (
          <div>
            {/* Hero Section */}
            <section className="bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16 grid lg:grid-cols-12 gap-10 items-stretch">
                <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                  <div className="text-xs font-semibold tracking-wider uppercase text-emerald-800">
                    Kepohbaru · Bojonegoro · Jawa Timur · Terakreditasi A
                  </div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-editorial font-semibold text-slate-950 leading-tight text-balance">
                    Pendidikan Islam Modern Berbasis Mutu, Sains, dan Akhlak Mulia
                  </h1>
                  <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                    {contents.profile?.body}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => handleNav('ppdb_kontak')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
                    >
                      Informasi PPDB 2026/2027
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNav('profil')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-800 border border-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      Profil & Visi Misi
                    </button>
                  </div>
                </div>
                <div className="lg:col-span-5">
                  <CampusHeroVisual
                    imageUrl={visuals.hero_kampus.url}
                    caption={visuals.hero_kampus.caption}
                  />
                </div>
              </div>

              {/* 4-Column Institutional Key Metrics Strip */}
              <div className="border-t border-slate-200 bg-slate-50/70">
                <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <div className="text-2xl font-tabular font-bold text-emerald-900">121</div>
                    <div className="text-xs text-slate-600 mt-0.5">Peserta Didik Aktif · X–XII</div>
                  </div>
                  <div>
                    <div className="text-2xl font-tabular font-bold text-emerald-900">18</div>
                    <div className="text-xs text-slate-600 mt-0.5">Guru & Tenaga Kependidikan</div>
                  </div>
                  <div>
                    <div className="text-2xl font-tabular font-bold text-emerald-900">A</div>
                    <div className="text-xs text-slate-600 mt-0.5">Akreditasi BAN-S/M Unggul</div>
                  </div>
                  <div>
                    <div className="text-2xl font-tabular font-bold text-emerald-900">2026</div>
                    <div className="text-xs text-slate-600 mt-0.5">SIMS & Supervisi Digital Aktif</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Sambutan Kepala Sekolah & Pengumuman */}
            <section className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
                <div className="text-xs font-medium text-slate-500">
                  Sambutan Kepala Sekolah · Kepemimpinan Pembelajaran
                </div>
                <div className="flex items-start gap-5">
                  <PrincipalAvatarVisual
                    name="Drs. H. Abdul Aziz, M.Pd."
                    imageUrl={visuals.foto_kepala_sekolah.url}
                  />
                  <div className="space-y-1">
                    <h2 className="text-2xl font-editorial font-semibold text-slate-900">
                      Drs. H. Abdul Aziz, M.Pd.
                    </h2>
                    <div className="text-sm text-emerald-800 font-medium">
                      Kepala SMA Darul Ulum Kepohbaru
                    </div>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Assalamu’alaikum warahmatullahi wabarakatuh. Melalui Sistem Informasi Manajemen
                  Sekolah (SIMS) terpadu ini, kami menghadirkan layanan pendidikan yang transparan
                  bagi orang tua, tertib administrasi bagi guru dan staf, serta supervisi mutu
                  berkelanjutan demi mencetak generasi berilmu amaliah dan beramal ilmiah.
                </p>
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Pengumuman Resmi</h3>
                  <button
                    type="button"
                    onClick={() => handleNav('kabar')}
                    className="text-xs font-semibold text-emerald-800 hover:underline whitespace-nowrap shrink-0"
                  >
                    Lihat Semua
                  </button>
                </div>
                <div className="divide-y divide-slate-200">
                  {announcements.slice(0, 3).map((ann) => (
                    <div key={ann.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                      <div className="text-xs text-slate-500 font-tabular">
                        {ann.publishedDate} · {ann.priority === 'penting' ? 'Prioritas' : 'Informasi'}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{ann.title}</div>
                      <p className="text-xs text-slate-600 line-clamp-2">{ann.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Berita & Agenda Ringkas */}
            <section className="max-w-7xl mx-auto px-6 pb-14 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-2xl font-editorial font-semibold text-slate-900">
                    Berita & Kegiatan Terbaru
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Dokumentasi aktivitas pembelajaran, prestasi, dan tata kelola sekolah.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNav('kabar')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:underline whitespace-nowrap shrink-0"
                >
                  Arsip Kabar <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {news.slice(0, 3).map((article, idx) => (
                  <article
                    key={article.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-emerald-700/40 transition-colors"
                  >
                    <div className="space-y-4">
                      <EditorialCardVisual
                        variant={idx === 0 ? 'academic' : idx === 1 ? 'partner' : 'culture'}
                        imageUrl={article.imageUrl}
                        alt={article.title}
                      />
                      <div className="text-xs text-slate-500">
                        <span>{article.category}</span>
                        <span className="mx-1.5">·</span>
                        <span className="font-tabular">{article.publishedDate}</span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 leading-snug">
                        {article.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                        {article.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNews(article)}
                      className="text-left text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      Baca Selengkapnya
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'profil' && (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
            {/* Profil & Sejarah */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium text-emerald-800">
                  Profil & Sejarah Institusi
                </div>
                <h1 className="text-3xl font-editorial font-semibold text-slate-950">
                  {contents.profile?.title}
                </h1>
                <p className="text-sm text-slate-500">{contents.profile?.subtitle}</p>
              </div>
              {isRenderableImageUrl(visuals.banner_profil.url) && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={visuals.banner_profil.url}
                    alt={visuals.banner_profil.caption || 'Foto Profil Sekolah'}
                    className="w-full max-h-[360px] object-cover"
                  />
                </div>
              )}
              <p className="text-base text-slate-700 leading-relaxed max-w-3xl">
                {contents.profile?.body}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-4 border-t border-slate-200">
                {(contents.profile?.items || []).map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="text-sm font-semibold text-slate-900">{item.value}</div>
                    {item.description && (
                      <div className="text-xs text-slate-500">{item.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Visi, Misi & Tujuan */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium text-emerald-800">Arah Pengembangan Mutu</div>
                <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                  {contents.vision_mission?.title}
                </h2>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-6 text-emerald-950 font-medium leading-relaxed">
                {contents.vision_mission?.body}
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {(contents.vision_mission?.items || []).map((item, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-5 space-y-2">
                    <div className="text-sm font-semibold text-emerald-900">{item.label}</div>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Struktur Organisasi */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div className="space-y-1">
                <div className="text-xs font-medium text-emerald-800">Tata Kelola Lembaga</div>
                <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                  {contents.organization?.title}
                </h2>
                <p className="text-sm text-slate-600">{contents.organization?.body}</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(contents.organization?.items || []).map((item, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-1">
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="text-sm font-semibold text-slate-900">{item.value}</div>
                    {item.description && (
                      <div className="text-xs text-slate-600">{item.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Direktori Guru & Tendik */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                    Data Guru & Tenaga Kependidikan
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Pendidik dan tenaga administrasi profesional SMA Darul Ulum Kepohbaru.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={dirSearch}
                      onChange={(e) => setDirSearch(e.target.value)}
                      placeholder="Cari nama atau mapel..."
                      className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(['semua', 'pimpinan', 'guru', 'tendik'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setDirFilter(r)}
                        className={`px-3 py-1 text-xs font-medium rounded-md capitalize whitespace-nowrap shrink-0 ${
                          dirFilter === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Nama Lengkap</th>
                      <th className="py-3 px-4 font-semibold">Jabatan</th>
                      <th className="py-3 px-4 font-semibold">Bidang / Mapel</th>
                      <th className="py-3 px-4 font-semibold">Pendidikan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredDirectory.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-900">{d.name}</td>
                        <td className="py-3 px-4 text-slate-700">{d.position}</td>
                        <td className="py-3 px-4 text-slate-600">{d.subject || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{d.education || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'akademik' && (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
            {/* Informasi Akademik & Kurikulum */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium text-emerald-800">Kurikulum & Pembelajaran</div>
                <h1 className="text-3xl font-editorial font-semibold text-slate-950">
                  {contents.academic_info?.title}
                </h1>
                <p className="text-sm text-slate-500">{contents.academic_info?.subtitle}</p>
              </div>
              <p className="text-base text-slate-700 leading-relaxed max-w-3xl">
                {contents.academic_info?.body}
              </p>
              <div className="grid md:grid-cols-3 gap-5">
                {(contents.academic_info?.items || []).map((item, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-5 space-y-1.5">
                    <div className="text-xs text-emerald-800 font-semibold">{item.label}</div>
                    <div className="text-base font-semibold text-slate-900">{item.value}</div>
                    {item.description && (
                      <p className="text-xs text-slate-600">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Rekap Statistik Data Siswa Publik (Non-PII) */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                  Rekapitulasi Data Siswa Aktif
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Sebaran rombongan belajar dan peserta didik SMA Darul Ulum Kepohbaru Tahun Pelajaran 2026/2027.
                </p>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Tingkat / Fase</th>
                      <th className="py-3 px-4 font-semibold">Jumlah Rombel</th>
                      <th className="py-3 px-4 font-semibold text-right">Siswa Putra</th>
                      <th className="py-3 px-4 font-semibold text-right">Siswa Putri</th>
                      <th className="py-3 px-4 font-semibold text-right">Total Siswa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-tabular">
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-slate-900">Kelas X (Fase E)</td>
                      <td className="py-3 px-4">2 Rombel</td>
                      <td className="py-3 px-4 text-right">22</td>
                      <td className="py-3 px-4 text-right">20</td>
                      <td className="py-3 px-4 text-right font-semibold">42</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-slate-900">Kelas XI (Fase F)</td>
                      <td className="py-3 px-4">2 Rombel</td>
                      <td className="py-3 px-4 text-right">19</td>
                      <td className="py-3 px-4 text-right">21</td>
                      <td className="py-3 px-4 text-right font-semibold">40</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-sans font-medium text-slate-900">Kelas XII (Fase F)</td>
                      <td className="py-3 px-4">2 Rombel</td>
                      <td className="py-3 px-4 text-right">18</td>
                      <td className="py-3 px-4 text-right">21</td>
                      <td className="py-3 px-4 text-right font-semibold">39</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Prestasi Siswa & Sekolah */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                  Prestasi Siswa & Sekolah
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Capaian akademik, riset, keagamaan, dan minat bakat di tingkat regional hingga nasional.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                {achievements.map((ach) => (
                  <div key={ach.id} className="border border-slate-200 rounded-lg p-5 space-y-2">
                    <div className="text-xs text-amber-700 font-semibold">
                      {ach.level} · {ach.year} · {ach.category}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{ach.title}</h3>
                    <div className="text-xs font-medium text-emerald-900">{ach.recipientName}</div>
                    {ach.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">{ach.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'kabar' && (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
            {/* Pengumuman & Kalender Akademik */}
            <div className="grid lg:grid-cols-12 gap-8">
              <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
                <h1 className="text-2xl font-editorial font-semibold text-slate-950">
                  Pengumuman Sekolah
                </h1>
                <div className="divide-y divide-slate-200">
                  {announcements.map((a) => (
                    <div key={a.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="text-xs text-slate-500 font-tabular">
                        {a.publishedDate} · {a.authorName} · {a.priority === 'penting' ? 'Prioritas' : 'Umum'}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">{a.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{a.content}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
                <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                  Kalender Akademik 2026/2027
                </h2>
                <div className="divide-y divide-slate-200">
                  {events.map((ev) => (
                    <div key={ev.id} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
                      <Calendar className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-xs text-emerald-800 font-semibold font-tabular">
                          {ev.startDate} s.d. {ev.endDate} · {ev.category}
                        </div>
                        <div className="text-sm font-semibold text-slate-900">{ev.title}</div>
                        {ev.description && (
                          <p className="text-xs text-slate-600">{ev.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Berita Sekolah */}
            <section className="space-y-6">
              <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                Berita & Kegiatan Sekolah
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {news.map((article, idx) => (
                  <article
                    key={article.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <EditorialCardVisual
                        variant={idx % 3 === 0 ? 'academic' : idx % 3 === 1 ? 'partner' : 'culture'}
                        imageUrl={article.imageUrl}
                        alt={article.title}
                      />
                      <div className="text-xs text-slate-500 font-tabular">
                        {article.category} · {article.publishedDate}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">{article.title}</h3>
                      <p className="text-sm text-slate-600">{article.summary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNews(article)}
                      className="text-left text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      Baca Artikel Lengkap
                    </button>
                  </article>
                ))}
              </div>
            </section>

            {/* Galeri Foto & Video */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                  Galeri Foto & Video
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Rekam jejak kegiatan pembelajaran, keagamaan, dan kemitraan sekolah.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {gallery.map((g, idx) => (
                  <div key={g.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <EditorialCardVisual
                      variant={idx % 2 === 0 ? 'culture' : 'academic'}
                      imageUrl={g.mediaUrl}
                      alt={g.title}
                    />
                    <div className="text-xs text-slate-500 font-tabular">
                      {g.mediaType.toUpperCase()} · {g.category} · {g.eventDate}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{g.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{g.caption}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'ppdb_kontak' && (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
            {/* Informasi PPDB */}
            <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium text-emerald-800">
                  Penerimaan Peserta Didik Baru
                </div>
                <h1 className="text-3xl font-editorial font-semibold text-slate-950">
                  {contents.ppdb?.title}
                </h1>
                <p className="text-sm text-slate-500">{contents.ppdb?.subtitle}</p>
              </div>
              {isRenderableImageUrl(visuals.banner_ppdb.url) && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={visuals.banner_ppdb.url}
                    alt={visuals.banner_ppdb.caption || 'Banner PPDB SMA Darul Ulum Kepohbaru'}
                    className="w-full max-h-[400px] object-cover"
                  />
                </div>
              )}
              <p className="text-base text-slate-700 leading-relaxed max-w-3xl">
                {contents.ppdb?.body}
              </p>
              <div className="grid md:grid-cols-2 gap-5">
                {(contents.ppdb?.items || []).map((item, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-5 space-y-1.5">
                    <div className="text-xs font-semibold text-emerald-800">{item.label}</div>
                    <div className="text-sm font-semibold text-slate-900">{item.value}</div>
                    {item.description && (
                      <p className="text-xs text-slate-600">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Kontak & Layanan Informasi */}
            <div className="grid lg:grid-cols-12 gap-8">
              <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-editorial font-semibold text-slate-950">
                    {contents.contact?.title}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">{contents.contact?.body}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-700">
                      Jl. Raya Kepohbaru No. 45, Kec. Kepohbaru, Kab. Bojonegoro, Jawa Timur 62194
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-700 font-tabular">
                      (0353) 551-248 / +62 812-3456-7890
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-700">info@smadukepohbaru.sch.id</div>
                  </div>
                </div>
              </section>

              <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 space-y-5">
                <h2 className="text-xl font-semibold text-slate-900">
                  Formulir Layanan Informasi Sekolah
                </h2>
                {inquirySubmitted ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 space-y-2">
                    <div className="text-sm font-semibold text-emerald-900">
                      Pesan Layanan Informasi Diterima
                    </div>
                    <p className="text-xs text-emerald-800">
                      Terima kasih telah menghubungi SMA Darul Ulum Kepohbaru. Staf Tata Usaha & Humas akan menindaklanjuti pertanyaan Anda pada jam layanan sekolah.
                    </p>
                    <button
                      type="button"
                      onClick={() => setInquirySubmitted(false)}
                      className="text-xs font-semibold text-emerald-900 underline"
                    >
                      Kirim Pesan Lainnya
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleInquirySubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nama Lengkap
                        </label>
                        <input
                          type="text"
                          required
                          value={inquiryForm.name}
                          onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          placeholder="Nama pemohon / wali murid"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nomor WhatsApp / Email
                        </label>
                        <input
                          type="text"
                          required
                          value={inquiryForm.contact}
                          onChange={(e) =>
                            setInquiryForm({ ...inquiryForm, contact: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          placeholder="08xx / email@contoh.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Topik Layanan
                      </label>
                      <select
                        value={inquiryForm.topic}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, topic: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      >
                        <option>Informasi PPDB</option>
                        <option>Mutasi & Data Kesiswaan</option>
                        <option>Akademik & Kurikulum</option>
                        <option>Kemitraan & Komite Sekolah</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Pesan / Pertanyaan
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={inquiryForm.message}
                        onChange={(e) =>
                          setInquiryForm({ ...inquiryForm, message: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        placeholder="Tuliskan kebutuhan informasi Anda..."
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900 transition-colors"
                    >
                      Kirim Permintaan Informasi
                    </button>
                  </form>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="text-base font-editorial font-semibold text-white">
              SMA Darul Ulum Kepohbaru
            </div>
            <div className="text-xs text-slate-400">
              Kepohbaru, Kabupaten Bojonegoro, Jawa Timur · Sistem Informasi Manajemen Sekolah Terpadu
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNav(item.key)}
                className="hover:text-white transition-colors"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenPortal}
              className="text-emerald-400 font-semibold hover:text-emerald-300"
            >
              Portal SIMS
            </button>
          </div>
        </div>
      </footer>

      {/* Modal Detail Berita */}
      {selectedNews && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 sm:p-8 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="text-xs text-slate-500 font-tabular">
                {selectedNews.category} · {selectedNews.publishedDate} · {selectedNews.authorName}
              </div>
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Tutup berita"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {isRenderableImageUrl(selectedNews.imageUrl) && (
              <img
                src={selectedNews.imageUrl}
                alt={selectedNews.title}
                className="w-full max-h-[320px] rounded-xl object-cover border border-slate-200"
              />
            )}
            <h2 className="text-2xl font-editorial font-semibold text-slate-950">
              {selectedNews.title}
            </h2>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
              {selectedNews.content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
