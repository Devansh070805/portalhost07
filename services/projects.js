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


/**
 * Fetches all projects and populates team, leader, subgroup, and assignment data.
 * Designed for the faculty dashboard.
 */
export async function getAllProjectsForFaculty() {
  const projects = [];
  try {
    // 1. Fetch all assignments first
    const assignmentsMap = new Map();
    const assignQuery = query(collection(db, "assignments"));
    const assignSnapshots = await getDocs(assignQuery);
    
    for (const assignDoc of assignSnapshots.docs) {
      const assignData = assignDoc.data();
      const projectId = assignData.projectId.id;

      if (!assignmentsMap.has(projectId)) {
      assignmentsMap.set(projectId, []);
    }
      
      let assignedToTeam = { id: null, name: "N/A" };
      if (assignData.assignedToTeamId) {
        const teamDoc = await getDoc(assignData.assignedToTeamId);
        if (teamDoc.exists()) {
          assignedToTeam = { id: teamDoc.id, name: teamDoc.data().teamName };
        }
      }
     // NEW: Push to the array
      assignmentsMap.get(projectId).push({
          id: assignDoc.id,
          assignedTo: assignedToTeam,
          status: assignData.status || "ASSIGNED", // Get status from assignment
      });
    }

    // 2. Fetch all projects
    const projectsQuery = query(collection(db, "projects"));
    const projectSnapshots = await getDocs(projectsQuery);

    for (const projectDoc of projectSnapshots.docs) {
      const projectData = projectDoc.data();
      const projectId = projectDoc.id;

      // 3. Get Project's Team, Leader, and Subgroup
      let team = { id: null, name: "N/A", leader: { name: "N/A", email: "N/A" }, subgroup: { name: "N/A" } };
      if (projectData.teamId) {
        const teamDoc = await getDoc(projectData.teamId); // This was the line with the error
        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
          let leaderData = { name: "N/A", email: "N/A" };
          let leaderSubgroup = "N/A";
          
          if (teamData.teamLeader) {
            const leaderDoc = await getDoc(teamData.teamLeader);
            if (leaderDoc.exists()) {
              const studentData = leaderDoc.data();
              leaderData = { name: studentData.name, email: studentData.email };
              leaderSubgroup = studentData.subgroup || "N/A";
            }
          }
          team = {
            id: teamDoc.id,
            name: teamData.teamName,
            leader: leaderData,
            subgroup: { name: leaderSubgroup }
          };
        }
      }

      // 4. Check for assignment
      const assignments = assignmentsMap.get(projectId) || []; // Get array

      projects.push({
        id: projectId,
        title: projectData.title,
        status: assignments.length > 0 ? "ASSIGNED" : (projectData.status || "UNASSIGNED"),
        testAssignments: assignments, // Note the plural 's'
        deployedLink: projectData.deployedLink,
        githubLink: projectData.githubLink,
        team: team,
      });
    }
    return projects;
  } catch (error) {
    console.error("Error fetching all projects for faculty: ", error);
    return [];
  }
}

export async function getAllProjectsForFacultyDashboard() {
    const projects = [];
    try {
        // 1. Fetch all assignments first
        const assignmentsMap = new Map();
        const assignQuery = query(collection(db, "assignments"));
        const assignSnapshots = await getDocs(assignQuery);
        
        for (const assignDoc of assignSnapshots.docs) {
            const assignData = assignDoc.data();
            const projectId = assignData.projectId.id;
            
            let assignedToTeam = { id: null, name: "N/A" };
            if (assignData.assignedToTeamId) {
                const teamDoc = await getDoc(assignData.assignedToTeamId);
                if (teamDoc.exists()) {
                    assignedToTeam = { id: teamDoc.id, name: teamDoc.data().teamName };
                }
            }
            assignmentsMap.set(projectId, {
                id: assignDoc.id,
                assignedTo: assignedToTeam,
                status: assignData.status || "ASSIGNED",
            });
        }

        // 2. Fetch all projects
        const projectsQuery = query(collection(db, "projects"));
        const projectSnapshots = await getDocs(projectsQuery);

        for (const projectDoc of projectSnapshots.docs) {
            const projectData = projectDoc.data();
            const projectId = projectDoc.id;

            // 3. Get Project's Team, Leader, and Subgroup
            let team = { id: null, name: "N/A", leader: { name: "N/A", email: "N/A" }, subgroup: { name: "N/A" } };
            if (projectData.teamId) {
                const teamDoc = await getDoc(projectData.teamId);
                if (teamDoc.exists()) {
                    const teamData = teamDoc.data();
                    let leaderData = { name: "N/A", email: "N/A" };
                    let leaderSubgroup = "N/A";

                    if (teamData.teamLeader) {
                        const leaderDoc = await getDoc(teamData.teamLeader);
                        if (leaderDoc.exists()) {
                            const studentData = leaderDoc.data();
                            leaderData = { name: studentData.name, email: studentData.email };
                            leaderSubgroup = studentData.subgroup || "N/A";
                        }
                    }
                    team = {
                        id: teamDoc.id,
                        name: teamData.teamName,
                        leader: leaderData,
                        subgroup: { name: leaderSubgroup }
                    };
                }
            }

            // 4. Check for assignment
            const assignment = assignmentsMap.get(projectId);

            projects.push({
                id: projectId,
                title: projectData.title,
                status: projectData.status || (assignment ? assignment.status : "UNASSIGNED"),
                deployedLink: projectData.deployedLink,
                githubLink: projectData.githubLink,
                team: team,
                testAssignment: assignment,
            });
        }
        return projects;
    } catch (error) {
        console.error("Error fetching all projects for faculty: ", error);
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