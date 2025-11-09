import { db } from './firebaseConfig.js';
import { doc, getDoc } from "firebase/firestore";

/**
 * Safely fetches a single student's data from a reference.
 */
async function getStudentById(studentRef) {
  if (!studentRef) return { name: "N/A", email: "N/A", subgroup: "N/A" };
  try {
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      const data = studentSnap.data();
      return {
        id: studentSnap.id,
        name: data.name || "Unknown",
        email: data.email || "N/A",
        subgroup: data.subgroup || "N/A", // Added missing subgroup field
      };
    }
  } catch (error) {
    console.error("Error fetching student:", error);
  }
  return { name: "N/A", email: "N/A", subgroup: "N/A" };
}

/**
 * Fetches an array of student objects from an array of references.
 * Marks the leader.
 */
export async function getTeamMembers(memberRefs = [], leaderRef) {
  const memberPromises = memberRefs.map(ref => getStudentById(ref));
  const members = await Promise.all(memberPromises);
  
  const leaderId = leaderRef?.id;
  
  return members.map(member => ({
    ...member,
    isLeader: member.id === leaderId
  }));
}