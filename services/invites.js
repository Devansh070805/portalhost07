import { db } from './firebaseConfig.js';
import {
  collection,
  addDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc, // <-- 1. IMPORT getDoc
  serverTimestamp,
  runTransaction,
  arrayUnion,
} from 'firebase/firestore';
// Note: writeBatch and updateDoc are not needed for this new function

/**
 * --- ⭐ NEW HELPER FUNCTION ---
 * Validates if a student is eligible to be invited based on new rules.
 * 1. Checks if email exists in 'students'
 * 2. Checks if email does NOT exist in 'faculty'
 * 3. Checks if student type is 'MEMBER'
 * 4. Checks if student subgroup matches the leader's subgroup
 * @returns {QuerySnapshot} studentSnap - The snapshot of the valid student.
 * @throws {Error} - Throws an error with a specific message if validation fails.
 */
async function validateInvitee(invitedEmail, leaderId) {
  // 1. Check if email exists in 'students'
  const studentQuery = query(
    collection(db, 'students'),
    where('email', '==', invitedEmail)
  );
  const studentSnap = await getDocs(studentQuery);

  if (studentSnap.empty) {
    throw new Error('No student found with this email address.');
  }
  // (Assuming email is unique in 'students' collection)
  const studentData = studentSnap.docs[0].data();

  // 2. Check if email exists in 'faculty'
  const facultyQuery = query(
    collection(db, 'faculty'),
    where('email', '==', invitedEmail)
  );
  const facultySnap = await getDocs(facultyQuery);

  if (!facultySnap.empty) {
    throw new Error('This email belongs to a faculty member, not a student.');
  }

  // 3. Check if student is a 'MEMBER'
  if (studentData.type !== 'MEMBER') {
    // Using "MEMBER" based on your createStudent function
    throw new Error('This student is a team leader and cannot be invited.');
  }

  // 4. Check if student subgroup matches leader's subgroup
  const leaderRef = doc(db, 'students', leaderId);
  const leaderSnap = await getDoc(leaderRef);

  if (!leaderSnap.exists()) {
    // This is a server-side check, should not fail if leader is logged in
    throw new Error('Team leader profile not found. Cannot verify subgroup.');
  }
  
  const leaderData = leaderSnap.data();
  if (studentData.subgroup !== leaderData.subgroup) {
    throw new Error(
      `Student must be in the same subgroup as the leader (${leaderData.subgroup}).`
    );
  }
  
  // All checks passed, return the student snapshot to avoid re-querying
  return studentSnap;
}

/**
 * --- ⭐ UPDATED FUNCTION ---
 * Sends an invite from a leader to a new member's email.
 * Now includes new validation rules.
 */
export async function sendInvite(leaderId, teamId, teamName, invitedEmail) {
  try {
    // --- 2. CALL NEW VALIDATION FUNCTION ---
    // This call performs all 3 of your new checks.
    // It will throw an error and stop if any check fails.
    // It returns studentSnap if successful.
    const studentSnap = await validateInvitee(invitedEmail, leaderId);
    // --- END NEW VALIDATION ---

    // 1. Check if the invited user is ALREADY on a team (Existing Logic)
    // We reuse studentSnap from our validation. We know it's not empty.
    const studentData = studentSnap.docs[0].data();
    if (studentData.teamId) {
      throw new Error('This user is already on a team.');
    }

    // 2. Check if this user ALREADY has a pending invite (Existing Logic)
    const inviteQuery = query(
      collection(db, 'invites'),
      where('invitedEmail', '==', invitedEmail),
      where('status', '==', 'pending')
    );
    const inviteSnap = await getDocs(inviteQuery);

    if (!inviteSnap.empty) {
      throw new Error('This user already has a pending invite.');
    }

    // 3. Create the invite (Existing Logic)
    const leaderRef = doc(db, 'students', leaderId);
    const teamRef = doc(db, 'teams', teamId);

    await addDoc(collection(db, 'invites'), {
      teamId: teamRef, // Storing the DocumentReference
      teamName: teamName, // Storing the name string
      invitedBy: leaderRef,
      invitedEmail: invitedEmail,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    return true; // Success
  } catch (error) {
    console.error('Error sending invite: ', error);
    throw error; // Re-throw the error to be caught by the component
  }
}

/**
 * Gets all pending invites for a user's email.
 * (This function is unchanged and correct)
 */
export async function getPendingInvites(userEmail) {
  const invites = [];
  const q = query(
    collection(db, 'invites'),
    where('invitedEmail', '==', userEmail),
    where('status', '==', 'pending')
  );

  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    invites.push({ id: doc.id, ...doc.data() });
  });

  return invites;
}

/**
 * Accepts an invite using a safe transaction.
 * (This function is unchanged and correct)
 */
export async function acceptInvite(inviteId, memberId) {
  const inviteRef = doc(db, 'invites', inviteId);
  const studentRef = doc(db, 'students', memberId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Read the invite
      const inviteSnap = await transaction.get(inviteRef);
      if (!inviteSnap.exists() || inviteSnap.data().status !== 'pending') {
        throw new Error('This invite is no longer valid.');
      }
      const inviteData = inviteSnap.data();
      const teamRef = inviteData.teamId; // This is the DocumentReference
      const teamName = inviteData.teamName; // This is the team name string

      if (!teamRef || !teamName) {
        throw new Error('Invite is invalid. Missing team data.');
      }

      // 2. Read the student document (inside the transaction)
      const studentSnap = await transaction.get(studentRef);
      if (!studentSnap.exists() || studentSnap.data().teamId) {
        throw new Error('You are already on a team.');
      }

      // 3. Add operations to the transaction
      
      // a) Update the student's document with BOTH teamId and teamName
      transaction.update(studentRef, {
        teamId: teamRef.id, // Store the ID string
        teamName: teamName, // Store the name string
      });

      // b) Update the team's document to add the new member
      transaction.update(teamRef, {
        members: arrayUnion(studentRef), // Add the student reference
      });

      // c) Delete the invite so it can't be used again
      transaction.delete(inviteRef);

      // 4. Return the data the component needs
      return { success: true, teamId: teamRef.id, teamName: teamName };
    });

    // The transaction was successful
    return result;

  } catch (error) {
    console.error('Error accepting invite: ', error);
    // The transaction failed
    return { success: false, teamId: null, teamName: null };
  }
}