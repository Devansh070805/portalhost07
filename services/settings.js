// services/settings.js
import { db } from './firebaseConfig.js';
import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  writeBatch,        // <-- NEW (for seeding helper)
} from "firebase/firestore";

// Global fallback (for old behaviour / if no faculty found)
const globalSettingsRef = doc(db, 'settings', 'submissionConfig');

/**
 * Internal helper: given a facultyEmail, return the appropriate settings doc ref.
 * - If facultyEmail matches a faculty doc, use settings/{facultyDocId}
 * - Otherwise, fall back to global settings/submissionConfig
 */
async function getSettingsRefForFaculty(facultyEmail) {
  if (!facultyEmail) {
    return globalSettingsRef;
  }

  try {
    const q = query(
      collection(db, 'faculty'),
      where('email', '==', facultyEmail)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      console.warn(
        `getSettingsRefForFaculty: No faculty doc found for email ${facultyEmail}, using global settings.`
      );
      return globalSettingsRef;
    }

    const facultyDocId = snap.docs[0].id;
    return doc(db, 'settings', facultyDocId);
  } catch (err) {
    console.error(
      'getSettingsRefForFaculty: error locating faculty settings, using global settings.',
      err
    );
    return globalSettingsRef;
  }
}

/**
 * Ensure a settings document exists for the given ref.
 * If it doesn't exist, create it with default values.
 *
 * @param {import("firebase/firestore").DocumentReference} settingsRef
 * @returns {Promise<{allowsSubmission: boolean, deadline: Timestamp | null}>}
 */
async function ensureSettingsDoc(settingsRef, facultyEmail) {
  const snap = await getDoc(settingsRef);

  if (!snap.exists()) {
    const defaultData = {
      allowsSubmission: true,
      deadline: null,
      facultyEmail: facultyEmail || null, // <--- NEW FIELD
    };
    await setDoc(settingsRef, defaultData, { merge: true });
    return defaultData;
  }

  const existing = snap.data();

  // If facultyEmail field is missing, patch it in
  if (!('facultyEmail' in existing)) {
    const patched = {
      ...existing,
      facultyEmail: facultyEmail || null,
    };
    await setDoc(settingsRef, patched, { merge: true });
    return patched;
  }

  return existing;
}

/**
 * Gets the submission settings for a given faculty.
 * If facultyEmail is omitted or faculty not found, uses the global settings doc.
 *
 * This will now ALSO create a doc for that faculty/global if it doesn't exist yet.
 *
 * @param {string} [facultyEmail]
 * @returns {Promise<{allowsSubmission: boolean, deadline: Timestamp | null}>}
 */
export async function getSubmissionSettings(facultyEmail) {
  try {
    const settingsRef = await getSettingsRefForFaculty(facultyEmail);
    const data = await ensureSettingsDoc(settingsRef, facultyEmail);
    return data;
  } catch (error) {
    console.error("Error fetching submission settings: ", error);
    return { allowsSubmission: true, deadline: null, facultyEmail: null };
  }
}


/**
 * Sets the submission deadline for the given faculty.
 * If facultyEmail is omitted, sets the global deadline.
 *
 * @param {Date} deadlineDate
 * @param {string} [facultyEmail]
 */
export async function setSubmissionDeadline(deadlineDate, facultyEmail) {
  try {
    const settingsRef = await getSettingsRefForFaculty(facultyEmail);
    const deadlineTimestamp = Timestamp.fromDate(deadlineDate);

    await setDoc(
      settingsRef,
      {
        allowsSubmission: true,
        deadline: deadlineTimestamp,
        facultyEmail: facultyEmail || null,
      },
      { merge: true }
    );

    console.log("Submission deadline set.");
    return true;
  } catch (error) {
    console.error("Error setting deadline: ", error);
    return false;
  }
}

/**
 * Toggles manual submission override for the given faculty.
 * If facultyEmail is omitted, toggles the global config.
 *
 * @param {boolean} isAllowed
 * @param {string} [facultyEmail]
 */
export async function toggleSubmissions(isAllowed, facultyEmail) {
  try {
    const settingsRef = await getSettingsRefForFaculty(facultyEmail);
    await setDoc(
      settingsRef,
      {
        allowsSubmission: isAllowed
      },
      { merge: true }
    );
    console.log(`Submissions set to: ${isAllowed}`);
    return true;
  } catch (error) {
    console.error("Error toggling submissions: ", error);
    return false;
  }
}

/**
 * Clears the submission deadline for the given faculty,
 * leaving submissions open indefinitely.
 * If facultyEmail is omitted, clears the global deadline.
 *
 * @param {string} [facultyEmail]
 */
export async function clearSubmissionDeadline(facultyEmail) {
  try {
    const settingsRef = await getSettingsRefForFaculty(facultyEmail);
       await setDoc(
      settingsRef,
      {
        allowsSubmission: true,
        deadline: null,
        facultyEmail: facultyEmail || null, // <--- NEW FIELD
      },
      { merge: true }
    );

    console.log("Submission deadline cleared.");
    return true;
  } catch (error) {
    console.error("Error clearing deadline: ", error);
    return false;
  }
}

/**
 * OPTIONAL: Seed settings documents for every faculty that exists.
 * Call this once from an admin script / page if you want to eagerly
 * create settings/{facultyDocId} for all faculty.
 */
export async function initializeSettingsForAllFaculty() {
  try {
    const facultySnap = await getDocs(collection(db, 'faculty'));

    const batch = writeBatch(db);
    facultySnap.forEach((facultyDoc) => {
      const facData = facultyDoc.data();
      const facultyEmail = facData?.email || null;

      const settingsRef = doc(db, 'settings', facultyDoc.id);
      batch.set(
        settingsRef,
        {
          allowsSubmission: true,
          deadline: null,
          facultyEmail, // <--- NEW FIELD
        },
        { merge: true }
      );
    });


    await batch.commit();
    console.log('Initialized settings docs for all faculty.');
    return true;
  } catch (error) {
    console.error('Error initializing settings for all faculty: ', error);
    return false;
  }
}



