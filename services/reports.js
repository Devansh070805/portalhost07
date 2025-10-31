import { db } from './firebaseConfig.js';
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getTeamMembers } from './students.js';
import { getProjectById } from './projects.js';

/**
 * Fetches all test cases for a specific assignment.
 * This is a non-realtime version for the report.
 */
async function getAllTestcasesForAssignment(assignmentId) {
  const testCases = [];
  try {
    const assignmentRef = doc(db, "assignments", assignmentId);
    const q = query(collection(db, "testcases"), where("assignmentId", "==", assignmentRef));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      testCases.push({ id: doc.id, ...doc.data() });
    });
  } catch (error) {
    console.error("Error fetching test cases for report:", error);
  }
  return testCases;
}

/**
 * Fetches all team data (team doc + member list).
 */
async function getTeamAndMembers(teamRef) {
  if (!teamRef) return { teamName: "N/A", members: [] };
  
  try {
    const teamSnap = await getDoc(teamRef);
    if (teamSnap.exists()) {
      const teamData = teamSnap.data();
      const members = await getTeamMembers(teamData.teamMembers, teamData.teamLeader);
      return {
        teamName: teamData.teamName || "Unknown Team",
        members: members
      };
    }
  } catch (error) {
    console.error("Error fetching team and members:", error);
  }
  return { teamName: "N/A", members: [] };
}


/**
 * Gathers all data for a complete testing report.
 * @param {string} assignmentId The ID of the assignment.
 * @returns {object|null} A comprehensive object with all report data.
 */
export async function getFullReportData(assignmentId) {
  try {
    // 1. Get Assignment
    const assignmentRef = doc(db, "assignments", assignmentId);
    const assignmentSnap = await getDoc(assignmentRef);
    if (!assignmentSnap.exists()) {
      throw new Error("Assignment not found");
    }
    const assignmentData = assignmentSnap.data();

    // 2. Get Project
    const project = await getProjectById(assignmentData.projectId.id);

    // 3. Get Original Team and its members
    const originalTeam = await getTeamAndMembers(assignmentData.jiskaProjectTeamId);

    // 4. Get Testing Team and its members
    const testingTeam = await getTeamAndMembers(assignmentData.assignedToTeamId);
    
    // 5. Get All Test Cases
    const testCases = await getAllTestcasesForAssignment(assignmentId);

    // 6. Compile and return the final data object
    return {
      assignmentId: assignmentId,
      project: project,
      originalTeam: originalTeam,
      testingTeam: testingTeam,
      testCases: testCases,
      testingStatus: assignmentData.status || "In Progress"
    };

  } catch (error) {
    console.error("Error building full report data:", error);
    return null;
  }
}
