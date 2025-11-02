// services/testcases.js
import { db } from './firebaseConfig.js';
import {
    collection,
    query,
    where,
    doc,
    addDoc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    getDocs,
    deleteDoc
} from "firebase/firestore";

/**
 * Gets all test cases for a specific assignment in REALTIME.
 * (Unchanged)
 */
export function getTestcasesForAssignment(assignmentId, callback) {
    const assignmentRef = doc(db, "assignments", assignmentId);
    const q = query(collection(db, "testcases"), where("assignmentId", "==", assignmentRef));

    // Listen for real-time updates
    const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
            const testCases = [];
            querySnapshot.forEach((doc) => {
                testCases.push({ id: doc.id, ...doc.data() });
            });
            callback(testCases);
        },
        (error) => {
            console.error("Error fetching test cases: ", error);
            callback([]); // Send empty array on error
        }
    );

    return () => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    };
}

export async function getTestcasesForAssignmentOnce(assignmentId) {
    const testCases = [];
    try {
        const assignmentRef = doc(db, "assignments", assignmentId);
        const q = query(collection(db, "testcases"), where("assignmentId", "==", assignmentRef));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            testCases.push({ 
                id: doc.id, 
                ...data,
                // Ensure timestamps are serializable, just in case
                creationTime: data.creationTime?.toDate ? data.creationTime.toDate().toISOString() : null,
                resultSubmissionTime: data.resultSubmissionTime?.toDate ? data.resultSubmissionTime.toDate().toISOString() : null
            });
        });
        
        return testCases;
    } catch (error) {
        console.error("Error fetching test cases once: ", error);
        return []; // Return empty array on error
    }
}

/**
 * --- MODIFIED FUNCTION ---
 * Creates a new test case document. Status defaults to 'pending'.
 * Removed 'designedBy' as input, now takes 'designedByUserId'.
 * Added 'tid' parameter.
 */
export async function createTestcase(assignmentId, title, description, designedByUserId, expectedResults, tid) {
    try {
        const assignmentRef = doc(db, "assignments", assignmentId);

        await addDoc(collection(db, "testcases"), {
            assignmentId: assignmentRef,
            testcaseName: title,
            testDescription: description,
            designedBy: designedByUserId, // <-- CHANGED: Storing the User ID/Name directly
            expectedResults: expectedResults,
            TID: tid, // <-- NEW: Added TID field
            testStatus: "pending",
            metadataImageUrl: null,
            testedBy: null,
            creationTime: serverTimestamp()
        });

        console.log("Test case created successfully for assignment:", assignmentId);
        return true;
    } catch (error) {
        console.error("Error creating test case: ", error);
        return false;
    }
}

/**
 * Updates the Firestore document with the public URL of the uploaded metadata.
 * (Unchanged)
 */
export async function setTestcaseMetadataUrl(testcaseId, publicFileUrl) {
    try {
        const testcaseRef = doc(db, "testcases", testcaseId);
        await updateDoc(testcaseRef, { metadataImageUrl: publicFileUrl });

        console.log("Metadata URL added to testcase:", testcaseId);
        return true;
    } catch (error) {
        console.error("Error setting metadata URL: ", error);
        return false;
    }
}


/**
 * --- MODIFIED FUNCTION ---
 * Submits the result (pass/fail) for a specific test case.
 * Now requires 'actualResult' and an optional 'debuggingReport' if status is 'fail'.
 */
export async function submitTestResult(testcaseId, status, testedByName, actualResult, debuggingReport = null) {
    try {
        const testcaseRef = doc(db, "testcases", testcaseId);
        
        const dataToUpdate = {
            testStatus: status,
            testedBy: testedByName,
            actualResult: actualResult, // <-- RENAMED from testLogs
            resultSubmissionTime: serverTimestamp()
        };

        if (status === 'fail' && debuggingReport) {
            // @ts-ignore
            dataToUpdate.debuggingReport = debuggingReport; // <-- NEW: Add the full report object
            // @ts-ignore
            dataToUpdate.severity = debuggingReport.severity || 'Low'; // <-- NEW: Store severity for easy access
        }

        await updateDoc(testcaseRef, dataToUpdate);

        console.log(`Test case ${testcaseId} marked as ${status}`);
        return true;
    } catch (error) {
        console.error("Error submitting test result: ", error);
        return false;
    }
}
/**
 * Gets test case statistics for an assignment.
 * (Unchanged)
 */
export async function getTestCaseStats(assignmentId) {
    let stats = { total: 0, pass: 0, fail: 0, pending: 0 };
    try {
        const assignmentRef = doc(db, "assignments", assignmentId);
        const q = query(collection(db, "testcases"), where("assignmentId", "==", assignmentRef));
        const querySnapshot = await getDocs(q);

        stats.total = querySnapshot.size; // Total count

        querySnapshot.forEach((doc) => {
            const status = doc.data().testStatus;
            if (status === 'pass') stats.pass++;
            else if (status === 'fail') stats.fail++;
            else stats.pending++;
        });

        return stats;
    } catch (error) {
        console.error("Error getting test case stats: ", error);
        return stats; // Return default stats on error
    }
}

export async function deleteTestcase(testcaseId) {
    if (!testcaseId) {
        console.error("No test case ID provided for deletion.");
        return false;
    }
    try {
        const testcaseRef = doc(db, "testcases", testcaseId);
        await deleteDoc(testcaseRef);
        console.log(`Test case ${testcaseId} deleted successfully.`);
        return true;
    } catch (error) {
        console.error("Error deleting test case: ", error);
        return false;
    }
}