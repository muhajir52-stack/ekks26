import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db, googleAuthProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { UserAccount, UserRole } from '../types/sims';
import { ROLE_LABELS } from '../types/sims';
import { logActivity } from '../lib/audit';
import { appendQuickActivityLog } from '../lib/quickLocalStore';
import { hydrateFromAppsScript, isAppsScriptEnvironment } from '../lib/gasBridge';

const BOOTSTRAPPED_ADMIN_EMAIL = 'muhajir52@guru.sma.belajar.id';
const QUICK_SESSION_STORAGE_KEY = 'sims_quick_account_id';

export interface QuickAccountOption {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  unitLabel: string;
  accessSummary: string;
}

export const QUICK_ACCOUNTS: QuickAccountOption[] = [
  {
    id: 'qa_super_admin',
    uid: 'qa_super_admin',
    displayName: 'Muhajir, S.Pd',
    email: 'muhajir52@guru.sma.belajar.id',
    role: 'super_admin',
    unitLabel: 'Super Administrator · SMA Darul Ulum Kepohbaru',
    accessSummary:
      'Akses penuh seluruh modul SIMS, Manajemen Siswa, Arsip Digital, Supervisi 88 Butir, CMS Web & Kelola Gambar',
  },
];

function toUserAccount(option: QuickAccountOption): UserAccount {
  return {
    id: option.id,
    uid: option.uid,
    email: option.email,
    displayName: option.displayName,
    role: option.role,
    activeStatus: 'aktif',
  };
}

function getStoredQuickAccount(): QuickAccountOption | null {
  try {
    const savedId = localStorage.getItem(QUICK_SESSION_STORAGE_KEY);
    if (!savedId) return null;
    return QUICK_ACCOUNTS.find((q) => q.id === savedId) || null;
  } catch {
    return null;
  }
}

function formatGoogleAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: string }).code) : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain' || raw.includes('auth/unauthorized-domain')) {
    return `Domain aplikasi terpublikasi ("${hostname}") belum diizinkan pada Firebase Authentication (Authorized Domains). Gunakan Menu Akun Masuk Langsung di bawah untuk langsung masuk ke dasbor.`;
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Jendela masuk Google ditutup sebelum proses selesai. Anda dapat mencoba lagi atau memilih Akun Masuk Langsung di bawah.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Pop-up diblokir oleh peramban. Mengalihkan ke halaman masuk Google atau gunakan Akun Masuk Langsung di bawah.';
  }
  if (code === 'auth/operation-not-supported-in-this-environment') {
    return 'Lingkungan pratinjau/iframe membatasi autentikasi Google pop-up. Silakan gunakan Menu Akun Masuk Langsung di bawah untuk masuk ke dasbor.';
  }
  return raw;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userAccount: UserAccount | null;
  effectiveRole: UserRole;
  previewRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  isQuickSession: boolean;
  quickAccounts: QuickAccountOption[];
  activeQuickAccountId: string | null;
  loginWithQuickAccount: (accountId: string) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [cloudUserAccount, setCloudUserAccount] = useState<UserAccount | null>(null);
  const [quickAccount, setQuickAccount] = useState<QuickAccountOption | null>(() =>
    getStoredQuickAccount()
  );
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;
    let cancelled = false;

    if (isAppsScriptEnvironment()) {
      hydrateFromAppsScript().finally(() => {
        if (!cancelled) {
          setAuthReady(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          try {
            localStorage.removeItem(QUICK_SESSION_STORAGE_KEY);
          } catch {
            // ignore
          }
          setQuickAccount(null);
          await logActivity({
            actorName: result.user.displayName || result.user.email || 'Pengguna',
            actorRole:
              result.user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
                ? 'super_admin'
                : 'pengguna',
            action: 'Login Berhasil',
            module: 'Autentikasi',
            details: `Masuk melalui Google Sign-In Redirect (${result.user.email}).`,
          });
        }
      })
      .catch((err) => {
        setAuthError(formatGoogleAuthError(err));
      });

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      setFirebaseUser(user);

      if (!user) {
        setCloudUserAccount(null);
        setAuthReady(true);
        return;
      }

      try {
        localStorage.removeItem(QUICK_SESSION_STORAGE_KEY);
      } catch {
        // ignore
      }
      setQuickAccount(null);

      const userRef = doc(db, 'users', user.uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const isAdminEmail =
            user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;
          const initialRole: UserRole = isAdminEmail ? 'super_admin' : 'orang_tua';
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Pengguna SIMS',
            role: initialRole,
            activeStatus: 'aktif',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await logActivity({
            actorName: user.displayName || user.email || 'Pengguna Baru',
            actorRole: initialRole,
            action: 'Registrasi / Login Pertama',
            module: 'Autentikasi',
            details: `Akun ${user.email} terdaftar otomatis dengan peran ${initialRole}.`,
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }

      unsubUserDoc = onSnapshot(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setCloudUserAccount({
              id: snapshot.id,
              ...(snapshot.data() as Omit<UserAccount, 'id'>),
            });
          }
          setAuthReady(true);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const loginWithQuickAccount = (accountId: string) => {
    const chosen = QUICK_ACCOUNTS.find((q) => q.id === accountId);
    if (!chosen) return;
    try {
      localStorage.setItem(QUICK_SESSION_STORAGE_KEY, chosen.id);
    } catch {
      // ignore
    }
    setQuickAccount(chosen);
    setPreviewRole(null);
    setAuthError(null);
    appendQuickActivityLog({
      actorUid: chosen.uid,
      actorName: chosen.displayName,
      actorRole: chosen.role,
      action: 'Masuk Akun Langsung',
      module: 'Autentikasi',
      details: `Masuk langsung ke dasbor sebagai ${ROLE_LABELS[chosen.role]} (${chosen.email}).`,
    });
  };

  const signInWithGoogle = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      try {
        localStorage.removeItem(QUICK_SESSION_STORAGE_KEY);
      } catch {
        // ignore
      }
      setQuickAccount(null);
      await logActivity({
        actorName: result.user.displayName || result.user.email || 'Pengguna',
        actorRole:
          result.user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
            ? 'super_admin'
            : 'pengguna',
        action: 'Login Berhasil',
        module: 'Autentikasi',
        details: `Masuk melalui Google Sign-In (${result.user.email}).`,
      });
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleAuthProvider);
          return;
        } catch (redirectErr) {
          setAuthError(formatGoogleAuthError(redirectErr));
        }
      } else {
        setAuthError(formatGoogleAuthError(err));
      }
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    const activeAcc = cloudUserAccount || (quickAccount ? toUserAccount(quickAccount) : null);
    if (firebaseUser && activeAcc) {
      await logActivity({
        actorName: activeAcc.displayName,
        actorRole: activeAcc.role,
        action: 'Logout',
        module: 'Autentikasi',
        details: `Keluar dari sesi (${activeAcc.email}).`,
      });
    } else if (activeAcc) {
      appendQuickActivityLog({
        actorUid: activeAcc.uid,
        actorName: activeAcc.displayName,
        actorRole: activeAcc.role,
        action: 'Logout',
        module: 'Autentikasi',
        details: `Keluar dari sesi akun langsung (${activeAcc.email}).`,
      });
    }
    try {
      localStorage.removeItem(QUICK_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setQuickAccount(null);
    setPreviewRole(null);
    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  const isQuickSession = !firebaseUser && quickAccount !== null;
  const userAccount: UserAccount | null = cloudUserAccount || (quickAccount ? toUserAccount(quickAccount) : null);
  const actualRole: UserRole = userAccount?.role || 'orang_tua';
  const effectiveRole: UserRole =
    actualRole === 'super_admin' && previewRole ? previewRole : actualRole;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userAccount,
        effectiveRole,
        previewRole,
        setPreviewRole,
        authReady,
        signingIn,
        authError,
        isQuickSession,
        quickAccounts: QUICK_ACCOUNTS,
        activeQuickAccountId: quickAccount?.id || null,
        loginWithQuickAccount,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return ctx;
}
