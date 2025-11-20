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
  getDocs
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
 * Gets the submission settings for a given faculty.
 * If facultyEmail is omitted or faculty not found, uses the global settings doc.
 *
 * @param {string} [facultyEmail]
 * @returns {Promise<{allowsSubmission: boolean, deadline: Timestamp | null}>}
 */
export async function getSubmissionSettings(facultyEmail) {
  try {
    const settingsRef = await getSettingsRefForFaculty(facultyEmail);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      // Default settings if document doesn't exist
      return { allowsSubmission: true, deadline: null };
    }
  } catch (error) {
    console.error("Error fetching submission settings: ", error);
    return { allowsSubmission: true, deadline: null };
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
        deadline: deadlineTimestamp
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
        deadline: null
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
