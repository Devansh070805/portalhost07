// services/settings.js
import { db } from './firebaseConfig.js';
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const settingsRef = doc(db, 'settings', 'submissionConfig');

/**
 * Gets the global submission settings.
 * @returns {Promise<{allowsSubmission: boolean, deadline: Timestamp | null}>}
 */
export async function getSubmissionSettings() {
  try {
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
 * Sets the submission deadline.
 * @param {Date} deadlineDate - The JS Date object for the deadline.
 */
export async function setSubmissionDeadline(deadlineDate) {
  try {
    const deadlineTimestamp = Timestamp.fromDate(deadlineDate);
    await setDoc(settingsRef, { 
      allowsSubmission: true, 
      deadline: deadlineTimestamp 
    }, { merge: true });
    console.log("Submission deadline set.");
    return true;
  } catch (error) {
    console.error("Error setting deadline: ", error);
    return false;
  }
}

/**
 * Toggles manual submission override.
 * @param {boolean} isAllowed 
 */
export async function toggleSubmissions(isAllowed) {
    try {
        await setDoc(settingsRef, { 
            allowsSubmission: isAllowed
        }, { merge: true });
        console.log(`Submissions set to: ${isAllowed}`);
        return true;
    } catch (error) {
        console.error("Error toggling submissions: ", error);
        return false;
    }
}

/**
 * Clears the submission deadline, opening submissions indefinitely.
 */
export async function clearSubmissionDeadline() {
  try {
    await setDoc(settingsRef, { 
      allowsSubmission: true, 
      deadline: null 
    }, { merge: true });
    console.log("Submission deadline cleared.");
    return true;
  } catch (error) {
    console.error("Error clearing deadline: ", error);
    return false;
  }
}