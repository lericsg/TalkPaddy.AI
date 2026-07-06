/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc 
} from 'firebase/firestore';
import { Meeting } from '../types';
import { getMeeting, saveMeeting } from './db';

/**
 * Recursively removes any keys with `undefined` values from an object.
 * Firestore does not allow `undefined` field values in payloads.
 */
function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }

  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      cleaned[key] = cleanUndefined(val);
    }
  }
  return cleaned;
}

/**
 * Saves a meeting document to Firestore.
 * Strips the binary `audioBlob` as Firestore has a 1MB limit.
 * The audioBlob is kept inside IndexedDB locally.
 */
export async function saveMeetingToFirestore(meeting: Meeting, userId: string): Promise<void> {
  if (!userId) {
    throw new Error('User is not authenticated.');
  }

  // Strip audioBlob to avoid Firestore size limitations
  const { audioBlob, ...firestorePayload } = meeting;

  const docRef = doc(db, 'meetings', meeting.id);
  const cleanPayload = cleanUndefined({
    ...firestorePayload,
    userId: userId
  });

  await setDoc(docRef, cleanPayload);
}

/**
 * Fetches all meetings belonging to the authenticated user from Firestore,
 * and enriches them with any locally stored audio blobs from IndexedDB.
 */
export async function fetchMeetingsFromFirestore(userId: string): Promise<Meeting[]> {
  if (!userId) {
    return [];
  }

  // Query by userId without ordering by createdAt. 
  // This avoids requiring a composite index in Firestore.
  const q = query(
    collection(db, 'meetings'),
    where('userId', '==', userId)
  );

  const querySnapshot = await getDocs(q);
  const firestoreMeetings: Meeting[] = [];

  querySnapshot.forEach((document) => {
    const data = document.data();
    firestoreMeetings.push({
      ...data,
      id: document.id,
    } as Meeting);
  });

  // Sort by newest first on the client side
  firestoreMeetings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Enrich with local audio blobs from IndexedDB if they exist
  const enrichedMeetings = await Promise.all(
    firestoreMeetings.map(async (meeting) => {
      try {
        const localMeeting = await getMeeting(meeting.id);
        if (localMeeting && localMeeting.audioBlob) {
          return {
            ...meeting,
            audioBlob: localMeeting.audioBlob
          };
        }
      } catch (err) {
        console.warn(`Could not read local audioBlob for meeting ${meeting.id} from IndexedDB:`, err);
      }
      return meeting;
    })
  );

  return enrichedMeetings;
}

/**
 * Deletes a meeting from Firestore.
 */
export async function deleteMeetingFromFirestore(id: string): Promise<void> {
  const docRef = doc(db, 'meetings', id);
  await deleteDoc(docRef);
}
