/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy,
  getDocs, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';

const firebaseConfig = {
  projectId: "massive-arbor-x3n78",
  appId: "1:391469535267:web:bc73cf22d0cd33569ce196",
  apiKey: "AIzaSyDYXa7vk1Js8xh7wYWaqcyswhwkxpTHG4w",
  authDomain: "massive-arbor-x3n78.firebaseapp.com",
  storageBucket: "massive-arbor-x3n78.firebasestorage.app",
  messagingSenderId: "391469535267"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Pass the custom firestoreDatabaseId from the configuration
export const db = getFirestore(app, "ai-studio-talkpaddymeeting-fe7d6422-3cf3-42aa-8088-f43af074a6b3");

// Authenticate helper: Sign in with Google Popup
export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

// Sign out helper
export async function logOut() {
  return signOut(auth);
}
