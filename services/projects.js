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
  updateDoc
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
      status: "PENDING"
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
            let assignmentInfo = null; // To store assignment details if found

            // Now, query the assignments collection to find the assignment for THIS project
            const assignmentQuery = query(collection(db, "assignments"), where("projectId", "==", projectDoc.ref));
            const assignmentSnapshots = await getDocs(assignmentQuery);

            if (!assignmentSnapshots.empty) {
                // Assuming a project only has one assignment in this system
                const assignmentDoc = assignmentSnapshots.docs[0];
                assignmentInfo = {
                    id: assignmentDoc.id, // THE CRUCIAL ASSIGNMENT ID
                    // You could add assignedToTeam details here if needed later
                };
            }

            projects.push({
                id: projectId,
                title: projectData.title,
                status: projectData.status, // Get the project's own status
                description: projectData.description,
                deployedLink: projectData.deployedLink,
                githubLink: projectData.githubLink,
                submissionTime: projectData.submissionTime,
                testAssignment: assignmentInfo, // Add the assignment info (or null)
                // Note: testCase1 and testCase2 are saved, but not fetched here
                // as this function seems to be for a list view.
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
        status: assignments.length > 0 ? "ASSIGNED" : (projectData.status || "PENDING"),
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
                status: projectData.status || (assignment ? assignment.status : "PENDING"),
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