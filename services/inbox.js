// services/inbox.js
import { db } from './firebaseConfig.js';
import {
    collection,
    query,
    where,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    serverTimestamp,
    arrayUnion,
    runTransaction,
    writeBatch
} from "firebase/firestore";

// NEW: import team helper so we know which teams a faculty owns
import { getAllTeamsForFaculty } from './teams.js';

// --- Helper Function to Populate Report Details ---
// This fetches the nested data for a single report
async function populateReportDetails(reportDoc) {
    const reportData = reportDoc.data();

    const projectSnap = reportData.projectId ? await getDoc(reportData.projectId) : null;
    const uploadingTeamSnap = reportData.uploadingTeamId ? await getDoc(reportData.uploadingTeamId) : null;
    const reportingTeamSnap = reportData.reportingTeamId ? await getDoc(reportData.reportingTeamId) : null;

    return {
        id: reportDoc.id,
        ...reportData,
        project: projectSnap?.exists()
            ? { id: projectSnap.id, ...projectSnap.data() }
            : { title: "Unknown Project" },
        uploadingTeam: uploadingTeamSnap?.exists()
            ? { id: uploadingTeamSnap.id, ...uploadingTeamSnap.data() }
            : { teamName: "Unknown Team" },
        reportingTeam: reportingTeamSnap?.exists()
            ? { id: reportingTeamSnap.id, ...reportingTeamSnap.data() }
            : { teamName: "Unknown Team" }
    };
}

// --- 1. For Faculty Dashboard ---
// NOW faculty-scoped: only reports for projects whose UPLOADING TEAM
// belongs to the faculty's subgroups.
export async function getReportsForFaculty(facultyEmail) {
    const reports = [];

    try {
        // If no faculty email, keep old behaviour (global view of all non-closed)
        let allowedTeamIds = null;

        if (facultyEmail) {
            const teams = await getAllTeamsForFaculty(facultyEmail);
            allowedTeamIds = new Set(
                (teams || [])
                    .filter((t) => t && t.id)
                    .map((t) => t.id)
            );

            // If faculty has no teams, they shouldn't see anything
            if (!allowedTeamIds.size) {
                console.warn(
                    `getReportsForFaculty: faculty ${facultyEmail} has no allowed teams – returning empty list.`
                );
                return [];
            }
        }

        // Fetch all non-closed reports
        const q = query(
            collection(db, "linkReports"),
            where("status", "!=", "CLOSED")
        );
        const querySnapshot = await getDocs(q);

        for (const reportDoc of querySnapshot.docs) {
            const data = reportDoc.data();

            // If we have a faculty scope, filter on uploadingTeamId
            if (allowedTeamIds) {
                const uploadingTeamRef = data.uploadingTeamId;
                const uploadingTeamId = uploadingTeamRef && uploadingTeamRef.id;

                if (!uploadingTeamId || !allowedTeamIds.has(uploadingTeamId)) {
                    // This report is for a team outside this faculty's subgroups
                    continue;
                }
            }

            const report = await populateReportDetails(reportDoc);
            reports.push(report);
        }

        // Sort to show active ones first
        return reports.sort((a, b) => {
            const order = { PENDING_APPROVAL: 1, OPEN: 2, DECLINED: 3 };
            return (order[a.status] || 99) - (order[b.status] || 99);
        });
    } catch (error) {
        console.error("Error fetching reports for faculty: ", error);
        return [];
    }
}

// --- 2. For Student Dashboard (As Uploader) ---
export async function getReportsForUploadingTeam(teamId) {
    const reports = [];
    if (!teamId) return reports;
    try {
        const teamRef = doc(db, "teams", teamId);
        const q = query(collection(db, "linkReports"), where("uploadingTeamId", "==", teamRef));
        const querySnapshot = await getDocs(q);

        for (const reportDoc of querySnapshot.docs) {
            const report = await populateReportDetails(reportDoc);
            // Anonymize reporting team
            report.reportingTeam = { teamName: "A Testing Team" };
            reports.push(report);
        }
        return reports.sort((a, b) => (a.status === "CLOSED" ? 1 : -1)); // Show active first
    } catch (error) {
        console.error("Error fetching reports for uploading team: ", error);
        return [];
    }
}

// --- 3. For Student Dashboard (As Tester) ---
export async function getReportsForTestingTeam(teamId) {
    const reports = [];
    if (!teamId) return reports;
    try {
        const teamRef = doc(db, "teams", teamId);
        const q = query(collection(db, "linkReports"), where("reportingTeamId", "==", teamRef));
        const querySnapshot = await getDocs(q);

        for (const reportDoc of querySnapshot.docs) {
            const report = await populateReportDetails(reportDoc);
            // Anonymize uploading team
            report.uploadingTeam = { teamName: "The Project Team" };
            reports.push(report);
        }
        return reports.sort((a, b) => (a.status === "CLOSED" ? 1 : -1)); // Show active first
    } catch (error) {
        console.error("Error fetching reports for testing team: ", error);
        return [];
    }
}

// --- 4. Action: Uploader Submits New Link ---
export async function submitNewLink(reportId, newLink, description) {
    try {
        const reportRef = doc(db, "linkReports", reportId);
        await updateDoc(reportRef, {
            status: "PENDING_APPROVAL",
            proposedNewUrl: newLink,
            logs: arrayUnion({
                timestamp: serverTimestamp(),
                action: "New Link Submitted by Team",
                description: description || newLink
            })
        });
        return true;
    } catch (error) {
        console.error("Error submitting new link: ", error);
        return false;
    }
}

// --- 5. Action: Faculty Approves Link (REVISED) ---
export async function approveNewLink(reportId) {
    try {
        const reportRef = doc(db, "linkReports", reportId);
        const reportSnap = await getDoc(reportRef);

        if (!reportSnap.exists()) {
            throw new Error("Report not found");
        }

        const { projectId, proposedNewUrl } = reportSnap.data();

        if (!projectId || !proposedNewUrl) {
            throw new Error(
                "Report is missing critical data (projectId or proposedNewUrl)"
            );
        }

        const assignmentsQuery = query(
            collection(db, "assignments"),
            where("projectId", "==", projectId),
            where("status", "==", "LINK_REPORTED")
        );

        const assignmentsToUnlockSnap = await getDocs(assignmentsQuery);

        const batch = writeBatch(db);

        batch.update(projectId, {
            deployedLink: proposedNewUrl
        });

        batch.update(reportRef, {
            status: "CLOSED",
            logs: arrayUnion({
                timestamp: serverTimestamp(),
                action: "Approved & Closed by Faculty"
            })
        });

        assignmentsToUnlockSnap.forEach((docSnap) => {
            batch.update(docSnap.ref, { status: "ASSIGNED" });
        });

        await batch.commit();

        console.log(
            `Transaction successful: Report closed, project updated, and ${assignmentsToUnlockSnap.size} assignments unlocked.`
        );
        return true;
    } catch (error) {
        console.error("Error approving new link (batch write failed): ", error);
        return false;
    }
}

// --- 6. Action: Faculty Declines Link ---
export async function declineNewLink(reportId, reason) {
    try {
        const reportRef = doc(db, "linkReports", reportId);
        await updateDoc(reportRef, {
            status: "DECLINED",
            proposedNewUrl: null,
            logs: arrayUnion({
                timestamp: serverTimestamp(),
                action: "Declined by Faculty",
                description: reason
            })
        });
        return true;
    } catch (error) {
        console.error("Error declining new link: ", error);
        return false;
    }
}
