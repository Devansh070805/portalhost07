// services/projects.js
import { db } from './firebaseConfig.js';
import { 
  collection, 
  addDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  getDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";

import { getAllTeamsForFaculty } from './teams';


/**
 * Creates a new project document with all submission details.
 */
export async function submitProject(projectData) {
  try {
    const teamRef = doc(db, "teams", projectData.teamId);

    const docRef = await addDoc(collection(db, "projects"), {
      teamId: teamRef,
      title: projectData.title,
      description: projectData.description, // This field now contains the "Project Scope"
      deployedLink: projectData.deployedLink || null,
      githubLink: projectData.githubLink,
      srsLink: projectData.srsLink || null,
      techStack: projectData.techStack.split(',').map(s => s.trim()),
      
      // <<< NEWLY ADDED FIELDS >>>
      testCase1: projectData.testCase1 || null,
      testCase2: projectData.testCase2 || null,
      // <<< END NEWLY ADDED FIELDS >>>
      
      submissionTime: serverTimestamp(),
      status: "UNASSIGNED"
    });

    console.log("Project submitted with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error submitting project: ", e);
    return null;
  }
}

/**
 * Gets all projects submitted by a specific team.
 */
export async function getProjectsByTeam(teamId) {
    const projects = [];
    try {
        const teamRef = doc(db, "teams", teamId);
        // Query projects submitted BY this team
        const projectQuery = query(collection(db, "projects"), where("teamId", "==", teamRef));
        const projectSnapshots = await getDocs(projectQuery);

        for (const projectDoc of projectSnapshots.docs) {
            const projectData = projectDoc.data();
            const projectId = projectDoc.id;
            const projectRef = projectDoc.ref;
            
            const assignmentDetails = []; // To store all assignment details

            // Now, query the assignments collection to find ALL assignments for THIS project
            const assignmentQuery = query(collection(db, "assignments"), where("projectId", "==", projectRef));
            const assignmentSnapshots = await getDocs(assignmentQuery);

            if (!assignmentSnapshots.empty) {
                // Loop through all assignments for this project
                for (const assignmentDoc of assignmentSnapshots.docs) {
                    const assignData = assignmentDoc.data();
                    let assignedToTeam = { id: null, name: "N/A" };

                    // Fetch the testing team's name
                    if (assignData.assignedToTeamId) {
                        try {
                            const teamDoc = await getDoc(assignData.assignedToTeamId);
                            if (teamDoc.exists()) {
                                assignedToTeam = { id: teamDoc.id, name: teamDoc.data().teamName };
                            }
                        } catch (e) {
                            console.error("Error fetching assigned-to team", e);
                        }
                    }
                    
                    assignmentDetails.push({
                        id: assignmentDoc.id, // THE CRUCIAL ASSIGNMENT ID
                        status: assignData.status || "ASSIGNED",
                        assignedTo: assignedToTeam
                    });
                }
            }

            projects.push({
                id: projectId,
                title: projectData.title,
                status: projectData.status, // Get the project's own status
                description: projectData.description,
                deployedLink: projectData.deployedLink,
                githubLink: projectData.githubLink,
                submissionTime: projectData.submissionTime,
                testAssignments: assignmentDetails, // Add the assignment info array
            });
        }

        return projects;
    } catch (error) {
        console.error("Error fetching projects by team (with assignment lookup): ", error);
        return []; // Return an empty array on error
    }
}

/**
 * Fetches a single project document by its ID.
 */
export async function getProjectById(projectId) {
  try {
    const projectRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectRef);

    if (projectSnap.exists()) {
      // Return all project data
      // This will automatically include testCase1 and testCase2 if they exist
      return { id: projectSnap.id, ...projectSnap.data() };
    } else {
      console.error("No project found with ID:", projectId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching project by ID:", error);
    return null;
  }
}


export async function getAllProjectsForFaculty(facultyEmail) {
  //console.time("getAllProjectsForFaculty");
  const projects = [];

  if (!facultyEmail) {
    console.error("getAllProjectsForFaculty: facultyEmail required");
    return projects;
  }

  try {
    // 1. Load ALL assignments, but batch team lookups
    const rawAssignments = [];
    const teamRefMap = new Map();

    const assignSnap = await getDocs(query(collection(db, "assignments")));

    assignSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const projectRef = data.projectId;
      const projectId = projectRef && projectRef.id;
      if (!projectId) return;

      let assignedToTeamRef = null;
      if (data.assignedToTeamId) {
        const ref = ensureDocRef(data.assignedToTeamId) || data.assignedToTeamId;
        if (ref && ref.path) {
          assignedToTeamRef = ref;
          teamRefMap.set(ref.path, ref);
        }
      }

      rawAssignments.push({
        id: docSnap.id,
        projectId,
        assignedToTeamRef,
        status: data.status || "ASSIGNED",
      });
    });

    // Batch fetch all team docs
    const uniqueRefs = Array.from(teamRefMap.values());
    const teamDocs = await Promise.all(uniqueRefs.map((ref) => getDoc(ref)));

    const teamDataByPath = new Map();
    uniqueRefs.forEach((ref, i) => {
      const snap = teamDocs[i];
      if (snap.exists()) {
        const d = snap.data();
        teamDataByPath.set(ref.path, {
          id: snap.id,
          name: d.teamName || "N/A",
        });
      } else {
        teamDataByPath.set(ref.path, { id: null, name: "N/A" });
      }
    });

    // Build projectId -> assignments[]
    const assignmentsMap = new Map();

    rawAssignments.forEach((a) => {
      const arr = assignmentsMap.get(a.projectId) || [];

      let assignedTo = { id: null, name: "N/A" };
      if (a.assignedToTeamRef && a.assignedToTeamRef.path) {
        const td = teamDataByPath.get(a.assignedToTeamRef.path);
        if (td) assignedTo = td;
      }

      arr.push({
        id: a.id,
        assignedTo,
        status: a.status,
      });

      assignmentsMap.set(a.projectId, arr);
    });

    // 2. Allowed teams
    const allowedTeams = await getAllTeamsForFaculty(facultyEmail);
    const teamIdToTeam = new Map();
    allowedTeams.forEach((t) => teamIdToTeam.set(t.id, t));

    if (teamIdToTeam.size === 0) return projects;

    // 3. Fetch all projects
    const projectSnap = await getDocs(query(collection(db, "projects")));

    projectSnap.docs.forEach((projSnap) => {
      const data = projSnap.data();
      const projectId = projSnap.id;

      const teamId =
        getTeamIdFromRefOrPath(data.teamId) ||
        getTeamIdFromRefOrPath(data.team) ||
        getTeamIdFromRefOrPath(data.teamRef);

      if (!teamId || !teamIdToTeam.has(teamId)) return;

      const team = teamIdToTeam.get(teamId);
      const assignments = assignmentsMap.get(projectId) || [];

      projects.push({
        id: projectId,
        title: data.title,
        status:
          assignments.length > 0
            ? "ASSIGNED"
            : data.status || "UNASSIGNED",
        testAssignments: assignments,
        deployedLink: data.deployedLink,
        githubLink: data.githubLink,
        team,
      });
    });

    return projects;
  } catch (e) {
    console.error("Error getAllProjectsForFaculty:", e);
    return [];
  } 
  // finally {
  //   console.timeEnd("getAllProjectsForFaculty");
  // }
}



// Helper to turn a string path into a DocumentReference
function ensureDocRef(maybePathOrRef) {
  if (!maybePathOrRef) return null;

  if (typeof maybePathOrRef === 'string') {
    const path = maybePathOrRef.startsWith('/')
      ? maybePathOrRef.slice(1)
      : maybePathOrRef;
    const [col, id] = path.split('/');
    if (col && id) return doc(db, col, id);
    return null;
  }

  if (
    typeof maybePathOrRef === 'object' &&
    maybePathOrRef !== null &&
    ('path' in maybePathOrRef || 'id' in maybePathOrRef)
  ) {
    return maybePathOrRef;
  }

  return null;
}

export async function getAllProjectsForFacultyDashboard(facultyEmail) {
  const projects = [];

  if (!facultyEmail) {
    console.error('getAllProjectsForFacultyDashboard: facultyEmail is required');
    return projects;
  }

  try {
    // 1) Get all teams this faculty is allowed to see
    const allowedTeams = await getAllTeamsForFaculty(facultyEmail);
    const teamIdToTeam = new Map();
    const allowedTeamIds = new Set();

    (allowedTeams || []).forEach((team) => {
      if (!team || !team.id) return;
      allowedTeamIds.add(team.id);
      teamIdToTeam.set(team.id, team); // contains leader + subgroup already
    });

    if (allowedTeamIds.size === 0) {
      console.warn(
        `getAllProjectsForFacultyDashboard: faculty ${facultyEmail} has no teams`
      );
      return projects;
    }

    // 2) Fetch all projects and keep only those belonging to allowed teams
    const projQ = query(collection(db, 'projects'));
    const projSnap = await getDocs(projQ);

    for (const pDoc of projSnap.docs) {
      const data = pDoc.data() || {};

      // Try multiple possible fields for the team link
      const teamId =
        getTeamIdFromRefOrPath(data.team) ||
        getTeamIdFromRefOrPath(data.teamRef) ||
        getTeamIdFromRefOrPath(data.teamId);

      if (!teamId || !allowedTeamIds.has(teamId)) {
        // project not in this faculty's subgroups
        continue;
      }

      const teamInfo = teamIdToTeam.get(teamId);

      projects.push({
        id: pDoc.id,
        title: data.title,
        description: data.description || '',
        status: data.status || 'UNASSIGNED',
        team: teamInfo
          ? {
              id: teamInfo.id,
              name: teamInfo.name,
              leader: teamInfo.leader,
              subgroup: teamInfo.subgroup || { name: 'N/A' },
            }
          : {
              // fallback if for some reason team is not found in map
              id: teamId,
              name: data.teamName || 'Unknown Team',
              leader: { id: '', name: 'N/A', email: 'N/A' },
              subgroup: { name: 'N/A' },
            },
        deployedLink: data.deployedLink || '',
        githubLink: data.githubLink || '',
      });
    }

    return projects;
  } catch (err) {
    console.error('Error in getAllProjectsForFacultyDashboard:', err);
    return [];
  }
}

export async function getProjectsAssignedToTeam(teamId) {
  const projectsToTest = [];
  try {
    // 1. Create a reference to your team
    const teamRef = doc(db, "teams", teamId);

    // 2. Query the 'assignments' collection
    const q = query(collection(db, "assignments"), where("assignedToTeamId", "==", teamRef));
    const assignmentsSnapshot = await getDocs(q);

    // 3. For each assignment, get the project and original team details
    for (const assignDoc of assignmentsSnapshot.docs) {
      const assignData = assignDoc.data();

      // Ensure references exist before proceeding
      if (!assignData.projectId || !assignData.jiskaProjectTeamId) continue;
      
      const projectDoc = await getDoc(assignData.projectId);
      const originalTeamDoc = await getDoc(assignData.jiskaProjectTeamId);

      if (projectDoc.exists() && originalTeamDoc.exists()) {
        const projectData = projectDoc.data();
        const originalTeamData = originalTeamDoc.data();

        // 4. Build the object matching the dashboard's Assignment interface
        projectsToTest.push({
          id: assignDoc.id, // Use assignment ID as the main ID
          status: assignData.status || "ASSIGNED", // Get status from assignment
          project: {
            id: projectDoc.id,
            title: projectData.title || "Untitled Project",
            // This is just a stub, so we don't need all the links here
          },
          originalTeam: { // Construct the originalTeam object
            id: originalTeamDoc.id,
            teamName: originalTeamData.teamName || "Unknown Team",
          },
        });
      }
    }

    return projectsToTest;

  } catch (error) {
    console.error("Error fetching projects to test: ", error);
    return [];
  }
}

export async function checkAndCompleteProject(projectId) {
    if (!projectId) {
        console.error("No Project ID provided to check.");
        return;
    }

    try {
        const projectRef = doc(db, "projects", projectId);
        
        // 1. Find all assignments for this project
        const q = query(collection(db, "assignments"), where("projectId", "==", projectRef));
        const assignmentsSnapshot = await getDocs(q);

        if (assignmentsSnapshot.empty) {
            console.log("No assignments found for this project. No action taken.");
            return; 
        }

        // 2. Check if all of them are "COMPLETED"
        let allComplete = true;
        for (const doc of assignmentsSnapshot.docs) {
            if (doc.data().status !== "COMPLETED") {
                allComplete = false; // Found one that is not complete
                break; // Stop checking
            }
        }

        // 3. If all are complete, update the project
        if (allComplete) {
            console.log("All assignments are complete. Marking project as COMPLETED.");
            await updateDoc(projectRef, {
                status: "COMPLETED"
            });
        } else {
            console.log("Not all assignments are complete. Project status not changed.");
        }

    } catch (error) {
        console.error("Error in checkAndCompleteProject: ", error);
    }
}

// --- NEW DELETE FUNCTION (converted to JS) ---

/**
 * Deletes a project, all its related assignments, and all test cases
 * for those assignments.
 *
 * @param {string} projectId The ID of the project in the 'projects' collection.
 * @returns {Promise<void>}
 */
export const deleteProject = async (projectId) => {
  console.log(`Starting deletion for project: ${projectId}`);
  const projectRef = doc(db, 'projects', projectId);

  try {
    // 1. Find all 'assignments' that point to this project
    const assignmentsQuery = query(
      collection(db, 'assignments'),
      where('projectRef', '==', projectRef)
    );

    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    console.log(`Found ${assignmentsSnapshot.size} related assignments to delete.`);

    const deletePromises = []; // Removed: : Promise<void>[]

    for (const assignmentDoc of assignmentsSnapshot.docs) {
      console.log(`Processing assignment: ${assignmentDoc.id}`);

      // 2. For each assignment, find and delete all test cases in its 'testCases' subcollection
      const testCasesQuery = query(collection(assignmentDoc.ref, 'testCases'));
      const testCasesSnapshot = await getDocs(testCasesQuery);

      console.log(`...found ${testCasesSnapshot.size} test cases to delete.`);
      testCasesSnapshot.forEach((testCaseDoc) => {
        // Add test case deletion to the promise list
        deletePromises.push(deleteDoc(testCaseDoc.ref));
      });

      // 3. Add the assignment deletion itself to the promise list
      deletePromises.push(deleteDoc(assignmentDoc.ref));
    }

    // 4. Add the original project deletion to the promise list
    deletePromises.push(deleteDoc(projectRef));

    // 5. Execute all deletes
    await Promise.all(deletePromises);

    console.log(`Successfully deleted project ${projectId} and all related data.`);

  } catch (error) {
    console.error('Error during cascading delete of project:', error);
    throw new Error('Failed to delete project and its related data.');
  }
};

/**
 * --- NEW FUNCTION ---
 * Updates only the deployedLink for a project.
 * To be called by faculty approval function.
 */
export async function updateProjectLink(projectId, newLink) {
    try {
        const projectRef = doc(db, "projects", projectId);
        await updateDoc(projectRef, {
            deployedLink: newLink
        });
        console.log(`Project ${projectId} link updated successfully.`);
        return true;
    } catch (error) {
        console.error("Error updating project link: ", error);
        return false;
    }
}

// Helper: get an ID from a doc ref / path / plain string
function getTeamIdFromRefOrPath(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    const path = value.startsWith('/') ? value.slice(1) : value;
    const segments = path.split('/');
    return segments[segments.length - 1] || null;
  }

  if (typeof value === 'object' && value !== null) {
    if (typeof value.id === 'string') return value.id;
    if (typeof value.path === 'string') {
      const segments = value.path.split('/');
      return segments[segments.length - 1] || null;
    }
  }

  return null;
}
