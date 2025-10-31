import { db } from './firebaseConfig.js';
// <<< FIX: Added query, getDocs, and getDoc >>>
import { 
  collection, 
  addDoc, 
  doc, 
  serverTimestamp, 
  getDoc, 
  getDocs, 
  query 
} from "firebase/firestore"; 

/**
 * Creates a new team document in the 'teams' collection.
 */
export async function createTeam(teamName, leaderAuthId, memberAuthIds) {
  try {
    const leaderRef = doc(db, "students", leaderAuthId);
    const memberRefs = memberAuthIds.map(id => doc(db, "students", id));

    const docRef = await addDoc(collection(db, "teams"), {
      teamName: teamName,
      teamLeader: leaderRef,
      teamMembers: memberRefs,
      createdAt: serverTimestamp()
    });

    console.log("Team created with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    return null;
  }
}

/**
 * Gets a single team's details from its ID.
 */
export async function getTeamDetails(teamId) {
  try {
    const teamDocRef = doc(db, "teams", teamId);
    const teamDoc = await getDoc(teamDocRef);

    if (teamDoc.exists()) {
      return { id: teamDoc.id, ...teamDoc.data() };
    } else {
      throw new Error("Team not found");
    }
  } catch (error) {
    console.error("Error getting team details: ", error);
    return null;
  }
}

/**
 * Fetches the full details for a list of student references.
 */
export async function getTeamMembersDetails(memberRefs) {
  try {
    const memberPromises = memberRefs.map(ref => getDoc(ref));
    const memberDocs = await Promise.all(memberPromises);

    const members = memberDocs.map(doc => {
      if (doc.exists()) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    }).filter(member => member !== null);

    return members;
  } catch (error) {
    console.error("Error fetching team members: ", error);
    return [];
  }
}

/**
 * Fetches all teams and populates their leader's data.
 * Designed for the faculty dashboard.
 */
export async function getAllTeamsForFaculty() {
  const teams = [];
  try {
    const teamsQuery = query(collection(db, "teams"));
    const teamSnapshots = await getDocs(teamsQuery);

    for (const teamDoc of teamSnapshots.docs) {
      const teamData = teamDoc.data();
      let leaderData = { name: "N/A", email: "N/A" };
      let leaderSubgroup = "N/A";

      // Fetch the leader's student document
      if (teamData.teamLeader) {
        const leaderDoc = await getDoc(teamData.teamLeader);
        if (leaderDoc.exists()) {
          const studentData = leaderDoc.data();
          leaderData = {
            name: studentData.name || "N/A",
            email: studentData.email || "N/A",
          };
          leaderSubgroup = studentData.subgroup || "N/A";
        }
      }

      teams.push({
        id: teamDoc.id,
        name: teamData.teamName,
        members: teamData.teamMembers || [],
        leader: leaderData,
        subgroup: { name: leaderSubgroup },
      });
    }
    return teams;
  } catch (error) {
    console.error("Error fetching all teams for faculty: ", error);
    return [];
  }
}