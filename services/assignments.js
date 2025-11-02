// services/assignments.js
import { db } from './firebaseConfig.js';
import {
    doc,
    getDoc,
    addDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    arrayUnion,
    writeBatch,
    setDoc,
    Timestamp,
    onSnapshot
} from "firebase/firestore";

// --- (FIX 1) ---
import { updateProjectLink } from './projects.js';

/**
 * Manually assigns a project to a testing team.
 */
export async function manualAssignProject(projectId, assignedToTeamId, jiskaProjectTeamId) {
  if (!projectId || !assignedToTeamId) {
    return { success: false, error: "Project and Team ID are required." };
  }

  if (assignedToTeamId === jiskaProjectTeamId) {
    return { success: false, error: "A team cannot test its own project." };
  }

  const projectRef = doc(db, "projects", projectId);
  const teamRef = doc(db, "teams", assignedToTeamId);

  try {
    const teamDoc = await getDoc(teamRef);
    if (!teamDoc.exists()) {
      return { success: false, error: "Assigned team not found." };
    }
    
    const teamName = teamDoc.data().teamName; 
    if (!teamName) {
        return { success: false, error: "Assigned team has no 'teamName' field." };
    }

    const newAssignment = {
      assignedTo: {
        id: assignedToTeamId,
        name: teamName
      },
      isProposed: false
    };

    await updateDoc(projectRef, {
      testAssignments: arrayUnion(newAssignment)
    });

    return { success: true };

  } catch (error) {
    console.error("Error manually assigning project: ", error);
    return { success: false, error: error.message };
  }
}

/**
 * Marks an assignment as complete.
 */
export async function markAssignmentComplete(assignmentId, projectId) {
    const batch = writeBatch(db);
    try {
        const assignmentRef = doc(db, "assignments", assignmentId);

        batch.update(assignmentRef, {
            status: "COMPLETED",
            completionTime: Timestamp.now() // ✅ replaced serverTimestamp()
        });

        await batch.commit();
        console.log(`Assignment ${assignmentId} marked as COMPLETED.`);
        return { success: true };

    } catch (error) {
        console.error("Error marking assignment complete: ", error);
        return { success: false, error: error.message };
    }
}

/**
 * Replaces all assignments on a project.
 */
export const replaceProjectAssignments = async (projectId, newAssignments) => {
  if (!projectId || !newAssignments) {
    return { success: false, error: "Invalid project ID or assignments." };
  }

  const projectRef = doc(db, "projects", projectId);
  const batch = writeBatch(db);

  try {
    // --- 1. Get the Project's Uploader Team ID ---
    // We need this to tell the assignment doc who built the project.
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      throw new Error("Project not found!");
    }
    // Get the reference to the team that uploaded the project
    const jiskaProjectTeamId = projectSnap.data().teamId; 
    if (!jiskaProjectTeamId) {
        throw new Error("Project is missing its 'teamId' (the uploader's team ref).");
    }

    //DELETING THE OLD ASSIGNEMTNS
    console.log(`[Assignments]: Deleting old assignments for project ${projectId}...`);
    const oldAssignmentsQuery = query(
        collection(db, "assignments"),
        where("projectId", "==", projectRef)
    );
    const oldAssignmentsSnap = await getDocs(oldAssignmentsQuery);
    oldAssignmentsSnap.forEach((doc) => {
        batch.delete(doc.ref); // Add deletion to the batch
    });
    console.log(`[Assignments]: Found and deleting ${oldAssignmentsSnap.size} old docs.`);

    // --- 2. Update the project doc's 'testAssignments' array ---
    const formattedAssignments = newAssignments.map(a => ({
      assignedTo: {
        id: a.teamId,   // ID of the team *doing* the testing
        name: a.teamName,
      },
      isProposed: false, // You set this to false, so it's a final assignment
    }));

    const newStatus = newAssignments.length > 0 ? "ASSIGNED" : "UNASSIGNED";

    batch.update(projectRef, {
      testAssignments: formattedAssignments,
      status: newStatus, 
      updatedAt: Timestamp.now(),
    });


    console.log(`[Assignments]: Creating ${newAssignments.length} new assignment docs...`);
    newAssignments.forEach(a => {
      const assignmentRef = doc(collection(db, "assignments"));
      
      batch.set(assignmentRef, {
        assignedToTeamId: doc(db, "teams", a.teamId), // The team *doing* the testing
        jiskaProjectTeamId: jiskaProjectTeamId,       // The team *who built* the project
        projectId: projectRef,                        // Reference to the project
        assignmentTime: Timestamp.now(),
        completionTime: null,
        status: "ASSIGNED", // <-- CRITICAL: Use "ASSIGNED" to match your logic
      });
    });

    // --- 4. Commit all changes at once ---
    await batch.commit();
    console.log("[Assignments]: Batch commit successful. Old assignments deleted, new ones created.");

    return { success: true };

  } catch (error) {
    console.error("Error replacing project assignments:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Saves the "Section A: General Evaluation" data to the assignment document.
 */
export async function saveAssignmentEvaluation(assignmentId, evaluationData) {
    if (!assignmentId) {
        return { success: false, error: "Assignment ID is required." };
    }
    try {
        const assignmentRef = doc(db, "assignments", assignmentId);
        await updateDoc(assignmentRef, {
            evaluation: evaluationData,
            lastUpdated: Timestamp.now() // ✅ replaced serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error saving evaluation: ", error);
        return { success: false, error: error.message };
    }
}

/**
 * Confirms all proposed assignments for a single project.
 */
export async function confirmProjectAssignments(projectId, proposedAssignments) {
  if (!projectId || !proposedAssignments || proposedAssignments.length === 0) {
    return { success: false, error: 'Project ID and assignments are required.' };
  }

  const projectRef = doc(db, 'projects', projectId);

  try {
    const confirmedAssignments = proposedAssignments.map((assignment) => ({
      assignedTo: {
        id: assignment.assignedTo.id,
        name: assignment.assignedTo.name,
      },
      isProposed: false,
    }));

    await updateDoc(projectRef, {
      testAssignments: confirmedAssignments,
    });

    return { success: true, projectId };
  } catch (error) {
    console.error(`Error confirming assignments for ${projectId}: `, error);
    return { success: false, error: error.message, projectId };
  }
}

/**
 * Creates a link report, locks assignments, and sends emails.
 */
export async function reportProjectLink(assignmentId, description, reportingTeamId) {
    console.log("\n--- [Report Logic]: reportProjectLink PROCESS STARTED ---");
    if (!assignmentId || !description || !reportingTeamId) {
        console.error("[Report Logic]: FAILED (Missing required fields).");
        return false;
    }

    try {
        const batch = writeBatch(db);
        const creationTime = Timestamp.now();

        // --- 1. Get Basic Data ---
        console.log("[Report Logic]: 1. Fetching assignment details...");
        const assignmentRef = doc(db, "assignments", assignmentId);
        const assignmentSnap = await getDoc(assignmentRef);
        if (!assignmentSnap.exists()) throw new Error("Source assignment not found.");

        const assignmentData = assignmentSnap.data();
        const projectId = assignmentData.projectId;
        const uploadingTeamId = assignmentData.jiskaProjectTeamId;
        const reportingTeamRef = doc(db, "teams", reportingTeamId);

        // --- 2. Get Project, Uploader, and Reporter Details ---
        console.log("[Report Logic]: 2. Fetching project, uploader, and reporter details...");
        const projectSnap = await getDoc(projectId);
        const projectName = projectSnap.data()?.title || "Unknown Project";
        const testAssignmentsArray = projectSnap.data()?.testAssignments || [];

        // Use the new helper function based on your schema
        const uploadingTeamDetails = await getTeamEmailDetails(uploadingTeamId);
        const reportingTeamDetails = await getTeamEmailDetails(reportingTeamRef);

        // --- 3. Get Faculty Email ---
        console.log("[Report Logic]: 3. Finding Faculty Email...");
        // Use the new helper function
        const facultyEmail = await getFacultyEmailBySubgroup(uploadingTeamDetails.subgroupString);

        // --- 4. Get ALL Affected Testing Teams Details ---
        console.log("[Report Logic]: 4. Fetching all affected teams...");
        const affectedTestingTeams = await Promise.all(
            testAssignmentsArray.map(async (assign) => {
                const teamRef = doc(db, "teams", assign.assignedTo.id);
                const details = await getTeamEmailDetails(teamRef); // Re-use the helper
                return { name: details.teamName, subgroup: details.subgroupString };
            })
        );
        
        // --- LOGS TO CHECK ---
        console.log("[Report Logic]: --- Data Gathered ---");
        console.log(`[Report Logic]: Project: ${projectName}`);
        console.log(`[Report Logic]: Uploader Email: ${uploadingTeamDetails.leaderEmail}`);
        console.log(`[Report Logic]: Uploader Subgroup: ${uploadingTeamDetails.subgroupString}`);
        console.log(`[Report Logic]: Faculty Email: ${facultyEmail}`);
        console.log(`[Report Logic]: Reporter: ${reportingTeamDetails.teamName}`);
        console.log("--------------------------");


        // --- 5. Create Firestore Report (Batch) ---
        console.log("[Report Logic]: 5. Adding report to batch...");
        const newReportRef = doc(collection(db, "linkReports"));
        batch.set(newReportRef, {
            projectId,
            uploadingTeamId,
            reportingTeamId: reportingTeamRef,
            status: "OPEN",
            createdAt: creationTime,
            sourceAssignmentId: assignmentRef,
            logs: []
        });

        // --- 6. Lock all related assignments (Batch) ---
        console.log("[Report Logic]: 6. Locking all related assignments...");
        const assignmentsQuery = query(
            collection(db, "assignments"),
            where("projectId", "==", projectId),
            where("status", "!=", "COMPLETED")
        );
        const assignmentsToLockSnap = await getDocs(assignmentsQuery);
        assignmentsToLockSnap.forEach((docSnap) => {
            batch.update(docSnap.ref, { status: "LINK_REPORTED" });
        });
        
        batch.update(projectId, { status: "BLOCKED_LINK" });

        // --- 7. Commit all Firestore changes ---
        await batch.commit(); 
        console.log(`[Report Logic]: 7. Batch commit SUCCESS. ${assignmentsToLockSnap.size} assignments locked.`);
        
        // --- 8. Add log (must be separate) ---
        await updateDoc(newReportRef, {
            logs: arrayUnion({
                timestamp: creationTime,
                action: "Report Created by Tester",
                description,
            }),
        });
        console.log("[Report Logic]: 8. Log added to report doc.");

        // --- 9. Send Emails (Fire and Forget) ---
        console.log("[Report Logic]: 9. Triggering emails...");
        
        // Email 1: To Uploader Team Leader
        if (uploadingTeamDetails.leaderEmail) {
            console.log(`[Report Logic]: ✅ Found Uploader Email. Sending to: ${uploadingTeamDetails.leaderEmail}`);
            fetch('/api/report-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: "uploader",
                    email: uploadingTeamDetails.leaderEmail,
                    projectName: projectName,
                    description: description
                }),
            }).catch(err => console.error("[Report Logic]: FAILED to send uploader email:", err));
        } else {
            console.warn("[Report Logic]: ❌ No Uploader Email. Skipping uploader notification.");
        }

        // Email 2: To Faculty
        if (facultyEmail) {
            console.log(`[Report Logic]: ✅ Found Faculty Email. Sending to: ${facultyEmail}`);
             fetch('/api/report-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: "faculty",
                    email: facultyEmail,
                    projectName: projectName,
                    description: description,
                    uploadingTeamName: uploadingTeamDetails.teamName,
                    uploadingTeamSubgroup: uploadingTeamDetails.subgroupString,
                    reportingTeamName: reportingTeamDetails.teamName,
                    reportingTeamSubgroup: reportingTeamDetails.subgroupString,
                    affectedTestingTeams: affectedTestingTeams
                }),
            }).catch(err => console.error("[Report Logic]: FAILED to send faculty email:", err));
        } else {
            console.warn("[Report Logic]: ❌ No Faculty Email. Skipping faculty notification.");
        }

        return true;
    } catch (error) {
        console.error("--- [Report Logic]: CRITICAL ERROR in reportProjectLink ---", error);
        return false;
    }
}

/**
 * Submits a new link for faculty approval.
 */
export async function submitNewLinkForReport(reportId, newLink) {
    try {
        const reportRef = doc(db, "linkReports", reportId);
        await updateDoc(reportRef, {
            status: "PENDING_APPROVAL",
            proposedNewUrl: newLink,
            logs: arrayUnion({
                timestamp: Timestamp.now(), // ✅
                action: "New Link Submitted",
                description: newLink,
            })
        });
        return true;
    } catch (error) {
        console.error("Error submitting new link: ", error);
        return false;
    }
}

/**
 * Approves the new link, updates the project, and unlocks the assignment.
 */
export async function approveNewLink(reportId) {
    const batch = writeBatch(db); // <-- 1. Use a batch
    try {
        const reportRef = doc(db, "linkReports", reportId);
        const reportSnap = await getDoc(reportRef);
        if (!reportSnap.exists()) throw new Error("Report not found");

        const { projectId, proposedNewUrl } = reportSnap.data();

        // 2. Validate data
        if (!projectId || !proposedNewUrl) {
            throw new Error("Report is missing critical data (projectId or proposedNewUrl)");
        }
        
        // 3. Update the Project's link (using your imported function)
        // This is not in the batch, but will run before.
        await updateProjectLink(projectId.id, proposedNewUrl); 

        // 4. Update the Report status
        batch.update(reportRef, {
            status: "CLOSED",
            logs: arrayUnion({
                timestamp: Timestamp.now(),
                action: "Approved by Faculty",
            })
        });

        batch.update(projectId, { status: "ASSIGNED" });

        // 5. Find and unlock ALL related assignments
        const assignmentsQuery = query(
            collection(db, "assignments"),
            where("projectId", "==", projectId), // Match the project
            where("status", "==", "LINK_REPORTED") // Find all locked ones
        );
        
        const assignmentsToUnlockSnap = await getDocs(assignmentsQuery);
        
        assignmentsToUnlockSnap.forEach((docSnap) => {
            batch.update(docSnap.ref, { status: "ASSIGNED" }); // Unlock them
        });

        // 6. Commit all batch operations
        await batch.commit();
        
        console.log(`Report approved. ${assignmentsToUnlockSnap.size} assignments unlocked.`);
        return true;
    } catch (error) {
        console.error("Error approving new link: ", error);
        return false;
    }
}

/**
 * Declines the new link and sends it back to the uploading team.
 */
export async function declineNewLink(reportId, reason) {
    try {
        const reportRef = doc(db, "linkReports", reportId);
        await updateDoc(reportRef, {
            status: "DECLINED",
            proposedNewUrl: null,
            logs: arrayUnion({
                timestamp: Timestamp.now(), // ✅
                action: "Declined by Faculty",
                description: reason,
            })
        });
        return true;
    } catch (error) {
        console.error("Error declining new link: ", error);
        return false;
    }
}

/**
 * Checks for any open or pending linkReports related to a project,
 * and dynamically locks or unlocks its assignments.
 */
let unsubscribeAutoLock = null;

export function autoLockAssignmentsForReports(projectId) {
  if (!projectId) return;

  // Stop previous listener if active
  if (unsubscribeAutoLock) unsubscribeAutoLock();

  const linkReportsQuery = query(
    collection(db, "linkReports"),
    where("projectId", "==", projectId),
    where("status", "in", ["OPEN", "PENDING_APPROVAL"])
  );

  unsubscribeAutoLock = onSnapshot(linkReportsQuery, async (snapshot) => {
    try {
      const hasActiveReport = !snapshot.empty;

      // Fetch all assignments for this project
      const assignmentsQuery = query(
        collection(db, "assignments"),
        where("projectId", "==", projectId)
      );
      const assignmentsSnap = await getDocs(assignmentsQuery);

      const batch = writeBatch(db);
      assignmentsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== "COMPLETED") {
          batch.update(docSnap.ref, {
            status: hasActiveReport ? "LINK_REPORTED" : "ASSIGNED",
          });
        }
      });

      await batch.commit();

      console.log(
        hasActiveReport
          ? `🔒 Live lock triggered for project ${projectId}`
          : `✅ Live unlock triggered for project ${projectId}`
      );
    } catch (err) {
      console.error("Error during auto lock/unlock:", err);
    }
  });
}

async function getFullTeamDetails(teamRef) {
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) return { teamName: "Unknown Team" };
    const teamData = teamSnap.data();

    let subgroupName = "No Subgroup";
    let facultyRef = null;
    if (teamData.subgroup) {
        const subgroupSnap = await getDoc(teamData.subgroup);
        if (subgroupSnap.exists()) {
            subgroupName = subgroupSnap.data().name || "Unknown Subgroup";
            facultyRef = subgroupSnap.data().faculty; // Get faculty ref
        }
    }

    let leaderEmail = null;
    if (teamData.teamLeader) {
        const leaderSnap = await getDoc(teamData.teamLeader);
        if (leaderSnap.exists()) {
            leaderEmail = leaderSnap.data().email;
        }
    }
    
    return {
        teamName: teamData.teamName || "Unknown Team",
        subgroupName,
        leaderEmail,
        facultyRef // Return the faculty ref
    };
}

async function getTeamEmailDetails(teamRef) {
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) {
        console.warn(`[Data Fetch]: Team not found at ${teamRef.path}`);
        return { teamName: "Unknown Team" };
    }
    const teamData = teamSnap.data();
    
    // Get Leader's info
    let leaderEmail = null;
    let subgroupString = "N/A";
    if (teamData.teamLeader) {
        const leaderSnap = await getDoc(teamData.teamLeader);
        if (leaderSnap.exists()) {
            leaderEmail = leaderSnap.data().email;
            subgroupString = leaderSnap.data().subgroup || "N/A";
        } else {
             console.warn(`[Data Fetch]: Leader doc not found at ${teamData.teamLeader.path}`);
        }
    } else {
        console.warn(`[Data Fetch]: Team ${teamData.teamName} has no 'teamLeader' field.`);
    }

    return {
        teamName: teamData.teamName || "Unknown Team",
        leaderEmail: leaderEmail,
        subgroupString: subgroupString
    };
}

async function getFacultyEmailBySubgroup(subgroupString) {
    if (!subgroupString || subgroupString === "N/A") {
        console.warn("[Data Fetch]: No subgroup string provided. Cannot find faculty.");
        return null;
    }

    // Query 'faculty' collection
    const q = query(
        collection(db, "faculty"),
        where("subgroupsUndertaking", "array-contains", subgroupString)
    );

    const facultyQuerySnap = await getDocs(q);
    if (facultyQuerySnap.empty) {
        console.warn(`[Data Fetch]: No faculty found for subgroup '${subgroupString}'.`);
        return null;
    }

    // Return the email of the first faculty found
    const facultyData = facultyQuerySnap.docs[0].data();
    return facultyData.email || null;
}