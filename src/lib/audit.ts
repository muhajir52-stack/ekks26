import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function logActivity(params: {
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  details: string;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await addDoc(collection(db, 'activity_logs'), {
      actorUid: uid,
      actorName: params.actorName.slice(0, 140),
      actorRole: params.actorRole.slice(0, 40),
      action: params.action.slice(0, 120),
      module: params.module.slice(0, 80),
      details: params.details.slice(0, 600),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Gagal mencatat audit log:', err);
  }
}
