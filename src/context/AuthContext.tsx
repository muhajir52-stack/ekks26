import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
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
import { logActivity } from '../lib/audit';

const BOOTSTRAPPED_ADMIN_EMAIL = 'muhajir52@guru.sma.belajar.id';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userAccount: UserAccount | null;
  effectiveRole: UserRole;
  previewRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      setFirebaseUser(user);

      if (!user) {
        setUserAccount(null);
        setPreviewRole(null);
        setAuthReady(true);
        return;
      }

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
            setUserAccount({
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

  const signInWithGoogle = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
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
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      setAuthError(msg);
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    if (userAccount) {
      await logActivity({
        actorName: userAccount.displayName,
        actorRole: userAccount.role,
        action: 'Logout',
        module: 'Autentikasi',
        details: `Keluar dari sesi (${userAccount.email}).`,
      });
    }
    setPreviewRole(null);
    await signOut(auth);
  };

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
