/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Archive,
  ArrowLeft,
  CalendarCheck,
  ClipboardCheck,
  Globe,
  GraduationCap,
  Image,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { db } from './lib/firebase';
import { isRenderableImageUrl, parseSiteVisuals } from './lib/imageUtils';
import { loadQuickRecord, QUICK_KEYS } from './lib/quickLocalStore';
import { PublicPortal } from './components/PublicPortal';
import { DashboardHome } from './components/DashboardHome';
import { ParentPortalView } from './components/ParentPortalView';
import { AcademicModule } from './components/AcademicModule';
import { AttendanceModule } from './components/AttendanceModule';
import { ArchiveModule } from './components/ArchiveModule';
import { SupervisionModule } from './components/SupervisionModule';
import { CmsAdminModule } from './components/CmsAdminModule';
import { ROLE_LABELS, type DashboardSection, type SchoolContent, type UserRole } from './types/sims';

interface NavConfig {
  id: DashboardSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavConfig[] = [
  {
    id: 'overview',
    label: 'Ringkasan Utama',
    icon: LayoutDashboard,
    roles: ['super_admin', 'kepala_sekolah', 'guru', 'tendik', 'supervisor', 'wali_kelas'],
  },
  {
    id: 'parent_portal',
    label: 'Portal Orang Tua',
    icon: Users,
    roles: ['orang_tua'],
  },
  {
    id: 'academic',
    label: 'Akademik & Siswa',
    icon: GraduationCap,
    roles: ['super_admin', 'kepala_sekolah', 'guru', 'tendik', 'wali_kelas'],
  },
  {
    id: 'attendance',
    label: 'Absensi & Notifikasi',
    icon: CalendarCheck,
    roles: ['super_admin', 'kepala_sekolah', 'guru', 'wali_kelas'],
  },
  {
    id: 'archives',
    label: 'Arsip Digital Sekolah',
    icon: Archive,
    roles: ['super_admin', 'kepala_sekolah', 'guru', 'tendik', 'supervisor', 'wali_kelas'],
  },
  {
    id: 'supervision',
    label: 'Supervisi Digital',
    icon: ClipboardCheck,
    roles: ['super_admin', 'kepala_sekolah', 'guru', 'supervisor'],
  },
  {
    id: 'cms',
    label: 'CMS Web Profil',
    icon: Globe,
    roles: ['super_admin', 'tendik'],
  },
  {
    id: 'cms_media',
    label: 'Kelola Gambar',
    icon: Image,
    roles: ['super_admin', 'tendik'],
  },
  {
    id: 'users_audit',
    label: 'Akun & Audit Log',
    icon: Shield,
    roles: ['super_admin', 'kepala_sekolah'],
  },
];

function SimsShell() {
  const {
    userAccount,
    effectiveRole,
    previewRole,
    setPreviewRole,
    authReady,
    signingIn,
    authError,
    isQuickSession,
    quickAccounts,
    activeQuickAccountId,
    loginWithQuickAccount,
    signInWithGoogle,
    logout,
  } = useAuth();

  const [viewMode, setViewMode] = useState<'public' | 'portal'>('public');
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState('');

  const allowedNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(effectiveRole)),
    [effectiveRole]
  );

  useEffect(() => {
    const localContent = loadQuickRecord<Record<string, SchoolContent>>(QUICK_KEYS.SCHOOL_CONTENT, {});
    if (localContent.site_visuals) {
      setSchoolLogoUrl(parseSiteVisuals(localContent.site_visuals).logo_sekolah.url);
    }
    const unsub = onSnapshot(
      doc(db, 'school_content', 'site_visuals'),
      (snap) => {
        const localOverride = loadQuickRecord<Record<string, SchoolContent>>(QUICK_KEYS.SCHOOL_CONTENT, {});
        if (localOverride.site_visuals) {
          setSchoolLogoUrl(parseSiteVisuals(localOverride.site_visuals).logo_sekolah.url);
          return;
        }
        if (snap.exists()) {
          const parsed = parseSiteVisuals(snap.data() as SchoolContent);
          setSchoolLogoUrl(parsed.logo_sekolah.url);
        } else {
          setSchoolLogoUrl('');
        }
      },
      () => {}
    );
    return () => unsub();
  }, [activeSection]);

  useEffect(() => {
    if (allowedNavItems.length === 0) return;
    const isAllowed = allowedNavItems.some((item) => item.id === activeSection);
    if (!isAllowed) {
      setActiveSection(allowedNavItems[0].id);
    }
  }, [allowedNavItems, activeSection]);

  if (viewMode === 'public') {
    return (
      <PublicPortal
        isAuthenticated={Boolean(userAccount)}
        onOpenPortal={() => setViewMode('portal')}
        onQuickLogin={(accountId) => {
          loginWithQuickAccount(accountId);
          setViewMode('portal');
        }}
      />
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 text-sm text-slate-600">
          Memuat sesi autentikasi SIMS SMA Darul Ulum Kepohbaru...
        </div>
      </div>
    );
  }

  if (!userAccount) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-4xl w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setViewMode('public')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Website Profil Sekolah
            </button>
            <div className="text-xs font-semibold tracking-wider uppercase text-emerald-800">
              Portal Terpadu · Kepohbaru, Bojonegoro
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-editorial font-semibold text-slate-950">
              Masuk ke Dasbor SIMS SMA Darul Ulum Kepohbaru
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Pilih salah satu akun pada Menu Akun Masuk Langsung untuk langsung mengakses dasbor
              tanpa kendala domain terpublikasi, atau gunakan Akun Google institusi Anda.
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg p-3 leading-relaxed">
              {authError}
            </div>
          )}

          {/* Menu Akun Masuk Langsung ke Dasbor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <KeyRound className="w-4 h-4 text-emerald-800" />
                <span>Menu Akun Masuk Langsung ke Dasbor</span>
              </div>
              <span className="text-xs text-slate-500">1 klik langsung buka dasbor</span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quickAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => loginWithQuickAccount(acc.id)}
                  className="text-left border border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/40 rounded-xl p-4 transition-colors flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-emerald-800">
                      {ROLE_LABELS[acc.role]}
                    </div>
                    <div className="text-sm font-semibold text-slate-950">
                      {acc.displayName}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {acc.email}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pt-1">
                      {acc.accessSummary}
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-emerald-800 group-hover:underline">
                    Masuk ke Dasbor →
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Google Sign-In Alternatif */}
          <div className="border-t border-slate-200 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500 space-y-0.5">
              <div className="font-semibold text-slate-700">
                Autentikasi Cloud Google & 7 Peran RBAC
              </div>
              <div>
                Gunakan tombol di samping apabila domain aplikasi telah terdaftar pada Firebase Authentication.
              </div>
            </div>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {signingIn ? 'Menghubungkan Akun Google...' : 'Masuk dengan Akun Google'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userAccount.activeStatus === 'nonaktif') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-4 text-center">
          <h1 className="text-xl font-editorial font-semibold text-slate-950">
            Akun Dinonaktifkan Sementara
          </h1>
          <p className="text-sm text-slate-600">
            Akun {userAccount.email} saat ini berstatus nonaktif. Hubungi Super Administrator SMA
            Darul Ulum Kepohbaru untuk mengaktifkan kembali akses Anda.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setViewMode('public')}
              className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg"
            >
              Website Sekolah
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentNav = allowedNavItems.find((n) => n.id === activeSection) || allowedNavItems[0];

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <DashboardHome onNavigate={setActiveSection} />;
      case 'parent_portal':
        return <ParentPortalView />;
      case 'academic':
        return <AcademicModule />;
      case 'attendance':
        return <AttendanceModule />;
      case 'archives':
        return <ArchiveModule />;
      case 'supervision':
        return <SupervisionModule />;
      case 'cms':
        return <CmsAdminModule mode="cms" initialCmsTab="profil" />;
      case 'cms_media':
        return <CmsAdminModule mode="cms" initialCmsTab="gambar" />;
      case 'users_audit':
        return <CmsAdminModule mode="users_audit" />;
      default:
        return <DashboardHome onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (260px fixed on desktop) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[260px] shrink-0 bg-emerald-950 text-emerald-50 flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {isRenderableImageUrl(schoolLogoUrl) && (
              <img
                src={schoolLogoUrl}
                alt="Logo SMA Darul Ulum"
                className="w-8 h-8 rounded-lg object-cover border border-emerald-700/60 shrink-0 bg-white"
              />
            )}
            <div className="min-w-0">
              <div className="text-sm font-editorial font-bold text-white leading-tight truncate">
                SMA Darul Ulum
              </div>
              <div className="text-[11px] text-emerald-300">SIMS Kepohbaru</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-emerald-200 hover:text-white"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allowedNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-emerald-800 text-white font-semibold'
                    : 'text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-900 space-y-3">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-white truncate">{userAccount.displayName}</div>
            <div className="text-[11px] text-emerald-300 truncate">{userAccount.email}</div>
            <div className="text-[11px] text-amber-300 font-medium">
              {ROLE_LABELS[effectiveRole]}
              {previewRole ? ' (Pratinjau)' : ''}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('public')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-emerald-900 hover:bg-emerald-800 text-emerald-50 rounded-lg transition-colors"
          >
            <Globe className="w-3.5 h-3.5" /> Lihat Web Profil Sekolah
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Buka menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 truncate">
              <span>SIMS</span>
              <span className="mx-1.5">/</span>
              <span className="font-semibold text-slate-900">{currentNav?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isQuickSession && (
              <>
                <select
                  aria-label="Ganti Akun Masuk Langsung"
                  value={activeQuickAccountId || 'qa_super_admin'}
                  onChange={(e) => loginWithQuickAccount(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-emerald-300 rounded-lg bg-emerald-50 text-emerald-950 font-medium max-w-[200px]"
                >
                  {quickAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      Akun: {ROLE_LABELS[acc.role]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={signingIn}
                  className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-900 border border-emerald-300 bg-white rounded-lg hover:bg-emerald-50 whitespace-nowrap shrink-0"
                >
                  {signingIn ? 'Menghubungkan...' : 'Hubungkan Google'}
                </button>
              </>
            )}

            {userAccount.role === 'super_admin' && (
              <select
                aria-label="Pratinjau Peran RBAC"
                value={previewRole || 'super_admin'}
                onChange={(e) => {
                  const val = e.target.value as UserRole;
                  setPreviewRole(val === 'super_admin' ? null : val);
                }}
                className="hidden md:block px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 font-medium"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    Tampilan: {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </header>

        {isQuickSession && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <span>
              Anda sedang masuk melalui <strong>Akun Langsung ({ROLE_LABELS[effectiveRole]})</strong>.
              Seluruh perubahan data di sesi ini tersimpan secara lokal di peramban Anda.
            </span>
            {authError && <span className="text-red-700 font-medium">{authError}</span>}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SimsShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
