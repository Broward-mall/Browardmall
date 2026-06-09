import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

if (!admin.getApps().length) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId || 'broward-8e8f1',
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
