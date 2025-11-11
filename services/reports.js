import { db } from './firebaseConfig.js';
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

// --- ASSUMED HELPERS (from your imports) ---
// These functions are imported but not defined here.
// I am assuming they work as follows:

// getTeamMembers:
// (membersRefArray, leaderRef) => Promise<HydratedTeamMember[]>
// (where HydratedTeamMember = {id, name, email, subgroup, isLeader})
import { getTeamMembers } from './students.js'; 

// getProjectById:
// (projectId) => Promise<Project>
// (where Project = {id, title, description, ...etc})
import { getProjectById } from './projects.js';

// --- EXISTING FUNCTIONS (Modified for new schema) ---

/**
 * Fetches all test cases for a specific assignment.
 * This is a non-realtime version for the report.
 * (This function is good, no changes needed)
 */
async function getAllTestcasesForAssignment(assignmentId) {
  const testCases = [];
  try {
    // Note: The PDF generator expects a DocumentReference, but the ID string works just as well.
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
 * (This function is good, no changes needed)
 */
export async function getTeamAndMembers(teamRef) {
  if (!teamRef) return { teamName: "N/A", members: [] };
  
  try {
    const teamSnap = await getDoc(teamRef);
    if (teamSnap.exists()) {
      const teamData = teamSnap.data();
      // Assumes getTeamMembers returns the full student objects
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

// --- NEW HELPER FUNCTIONS ---

/**
 * Fetches all link reports for a given project.
 * Also resolves the reporting team's name.
 */
export async function getLinkReportsForProject(projectId) {
  const reports = [];
  // Assumes projectId is a DocumentReference
  const q = query(collection(db, "linkReports"), where("projectId", "==", projectId));
  const querySnapshot = await getDocs(q);
  
  for (const doc of querySnapshot.docs) {
    const data = doc.data();
    let teamName = "Unknown";
    
    // Fetch the reporting team's name
    if (data.reportingTeamId) {
      try {
        const teamSnap = await getDoc(data.reportingTeamId);
        if (teamSnap.exists()) {
          teamName = teamSnap.data().teamName || "Unknown";
        }
      } catch (e) {
        console.error("Error fetching reporting team name:", e);
      }
    }
    
    reports.push({
      id: doc.id,
      logs: data.logs || [],
      proposedNewLink: data.proposedNewLink || 'N/A',
      status: data.status || 'N/A',
      reportingTeamName: teamName, // Required by PDF generator
    });
  }
  return reports;
}

/**
 * Fetches and hydrates all assignments for a given project.
 */
export async function getAllHydratedAssignments(projectId) {
  const hydratedAssignments = [];
  // 1. Find all assignments for this project
  // Assumes projectId is a DocumentReference
  const q = query(collection(db, "assignments"), where("projectId", "==", projectId));
  const assignmentsSnapshot = await getDocs(q);

  if (assignmentsSnapshot.empty) {
    console.warn("No assignments found for project:", projectId.id);
    return [];
  }

  // 2. Loop and hydrate each one
  for (const assignmentDoc of assignmentsSnapshot.docs) {
    const assignmentData = assignmentDoc.data();
    const assignmentId = assignmentDoc.id;

    // 2a. Get this assignment's testing team
    const testingTeam = await getTeamAndMembers(assignmentData.assignedToTeamId);

    // 2b. Get this assignment's test cases
    const testCases = await getAllTestcasesForAssignment(assignmentId);

    hydratedAssignments.push({
      id: assignmentId,
      status: assignmentData.status || 'N/A',
      testingTeam: testingTeam,
      testCases: testCases,
    });
  }
  return hydratedAssignments;
}


// --- REWRITTEN CORE FUNCTION ---

/**
 * Gathers all data for a complete testing report based on the new schema.
 * Uses assignmentId as an entry point to find the project.
 * @param {string} assignmentId The ID of ANY assignment related to the project.
 * @returns {object|null} A comprehensive object with all report data.
 */
export async function getFullReportData(assignmentId) {
  try {
    // 1. Get the MAIN assignment to find the project
    const mainAssignmentRef = doc(db, "assignments", assignmentId);
    const mainAssignmentSnap = await getDoc(mainAssignmentRef);
    if (!mainAssignmentSnap.exists()) {
      throw new Error("Main assignment not found");
    }
    const mainAssignmentData = mainAssignmentSnap.data();

    // 2. Get the Project ID and Original Team ID (as DocumentReferences)
    const projectId = mainAssignmentData.projectId; 
    const originalTeamId = mainAssignmentData.jiskaProjectTeamId;

    if (!projectId) {
      throw new Error("Project ID missing from assignment");
    }

    // 3. Fetch the Project data
    // (Assumes getProjectById can take a DocumentReference ID string)
    const project = await getProjectById(projectId.id);

    // 4. Fetch the Original Team data
    const originalTeam = await getTeamAndMembers(originalTeamId);

    // 5. Fetch all Link Reports for the project
    const linkReports = await getLinkReportsForProject(projectId);

    // 6. Fetch and hydrate ALL assignments for the project
    const assignments = await getAllHydratedAssignments(projectId);
    
    // 7. Compile and return the final data object
    return {
      project: project,
      originalTeam: originalTeam,
      linkReports: linkReports,
      assignments: assignments,
    };

  } catch (error) {
    console.error("Error building full report data:", error);
    return null;
  }
}