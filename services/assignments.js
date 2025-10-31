import { db } from './firebaseConfig.js';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  writeBatch,
  serverTimestamp 
} from "firebase/firestore";

/**
 * Manually assigns a project to a testing team.
 */
export async function manualAssignProject(projectId, assignedToTeamId, jiskaProjectTeamId) {
  const batch = writeBatch(db);
  try {
    // 1. Create references
    const projectRef = doc(db, "projects", projectId);
    const assignedToTeamRef = doc(db, "teams", assignedToTeamId);
    const jiskaProjectTeamRef = doc(db, "teams", jiskaProjectTeamId);

    // 2. Create the new assignment document
    const assignmentRef = doc(collection(db, "assignments")); // Create a new doc ref
    batch.set(assignmentRef, {
      projectId: projectRef,
      assignedToTeamId: assignedToTeamRef,
      jiskaProjectTeamId: jiskaProjectTeamRef,
      assignmentTime: serverTimestamp()
    });

    // 3. Update the project's status
    batch.update(projectRef, {
      status: "ASSIGNED"
    });

    // 4. Commit the batch
    await batch.commit();
    return { success: true, assignmentId: assignmentRef.id };

  } catch (error) {
    console.error("Error manually assigning project: ", error);
    return { success: false, error: error.message };
  }
}

export async function markAssignmentComplete(assignmentId, projectId) {
    const batch = writeBatch(db);
    try {
        const assignmentRef = doc(db, "assignments", assignmentId);
        //const projectRef = doc(db, "projects", projectId);

        // Update assignment status
        batch.update(assignmentRef, {
            status: "COMPLETED",
            completionTime: serverTimestamp()
        });

        await batch.commit();
        console.log(`Assignment ${assignmentId} marked as COMPLETED.`); // Updated log
        return { success: true };

    } catch (error) {
        console.error("Error marking assignment complete: ", error);
        return { success: false, error: error.message };
    }
}