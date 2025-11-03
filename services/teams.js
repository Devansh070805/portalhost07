// services/teams.js  (replace your current file with this)
import { db } from './firebaseConfig.js';
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
 * Helper: If input is a string path like "/students/abc" or "students/abc",
 * return a DocumentReference (doc(db, collection, id)). Otherwise return the original ref.
 */
function ensureDocRef(maybePathOrRef) {
  if (!maybePathOrRef) return null;

  // strings like "/students/abc" or "students/abc"
  if (typeof maybePathOrRef === 'string') {
    const path = maybePathOrRef.startsWith('/') ? maybePathOrRef.slice(1) : maybePathOrRef;
    const [collectionName, id] = path.split('/');
    if (collectionName && id) {
      return doc(db, collectionName, id);
    }
    return null;
  }

  // If it's already a DocumentReference from Firestore it should have a .path (and .id)
  if (typeof maybePathOrRef === 'object' && maybePathOrRef !== null && ('path' in maybePathOrRef || 'id' in maybePathOrRef)) {
    // If it already looks like a DocumentReference, return as-is
    return maybePathOrRef;
  }

  // other shapes -> null
  return null;
}

/**
 * Creates a new team document in the 'teams' collection.
 * memberAuthIds is an array of student document ids (strings).
 */
export async function createTeam(teamName, leaderAuthId, memberAuthIds) {
  try {
    const leaderRef = doc(db, "students", leaderAuthId);
    const memberRefs = (memberAuthIds || []).map(id => doc(db, "students", id));

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
 * Normalizes:
 *  - teamMembers -> Array (if object with numeric keys we convert via Object.values)
 *  - teamLeader -> DocumentReference when possible (if stored as string path we convert)
 */
export async function getTeamDetails(teamId) {
  try {
    const teamDocRef = doc(db, "teams", teamId);
    const teamDoc = await getDoc(teamDocRef);

    if (!teamDoc.exists()) {
      throw new Error("Team not found");
    }

    const raw = teamDoc.data() || {};

    // Normalize teamMembers to an array
    let teamMembers = raw.teamMembers ?? [];
    if (!Array.isArray(teamMembers) && typeof teamMembers === 'object' && teamMembers !== null) {
      // sometimes Firestore arrays end up as objects with numeric keys -> convert
      teamMembers = Object.values(teamMembers);
    }

    // Ensure teamLeader is a DocumentReference when possible (so .id is available)
    let teamLeader = raw.teamLeader ?? null;
    if (typeof teamLeader === 'string') {
      const maybeRef = ensureDocRef(teamLeader);
      if (maybeRef) teamLeader = maybeRef;
    }

    return {
      id: teamDoc.id,
      ...raw,
      teamMembers,
      teamLeader
    };
  } catch (error) {
    console.error("Error getting team details: ", error);
    return null;
  }
}

/**
 * Fetches the full details for a list of student references.
 * Accepts:
 *  - an array of DocumentReference objects,
 *  - an array of strings like "/students/abc" or "students/abc",
 *  - an object with numeric keys (will be converted to array),
 *  - or a mixed array.
 *
 * Returns array of { id, name, email, type } with defaults for missing docs.
 */
export async function getTeamMembersDetails(memberRefs) {
  try {
    if (!memberRefs) return [];

    // normalize to array if it's an object with numeric keys
    let refsArr = Array.isArray(memberRefs) ? memberRefs : Object.values(memberRefs);

    // Defensive: filter out null/undefined quickly
    refsArr = refsArr.filter(r => r !== null && r !== undefined);

    const out = [];

    for (const r of refsArr) {
      try {
        // If it's a string path like "/students/abc" or "students/abc" => make doc ref
        if (typeof r === 'string') {
          const possibleRef = ensureDocRef(r);
          if (!possibleRef) {
            // can't parse, push a placeholder
            out.push({ id: String(r), name: 'Unknown', email: '', type: 'MEMBER' });
            continue;
          }
          const snap = await getDoc(possibleRef);
          if (snap.exists()) {
            const d = snap.data();
            out.push({
              id: snap.id,
              name: d?.name || d?.displayName || 'No Name',
              email: d?.email || '',
              type: d?.type || 'MEMBER'
            });
          } else {
            out.push({ id: possibleRef.id, name: 'Deleted user', email: '', type: 'MEMBER' });
          }
          continue;
        }

        // If it's an object / DocumentReference-like
        if (typeof r === 'object') {
          // If it already looks like a DocumentReference (has .path or .id)
          if ('path' in r || 'id' in r) {
            // Try to use getDoc directly if it is a real DocumentReference
            // (getDoc accepts DocumentReference). If r is a plain object with only id,
            // fall through to create a doc ref for students collection.
            if ('path' in r && typeof r.path === 'string') {
              try {
                const snap = await getDoc(r); // r is DocumentReference
                if (snap.exists()) {
                  const d = snap.data();
                  out.push({
                    id: snap.id,
                    name: d?.name || d?.displayName || 'No Name',
                    email: d?.email || '',
                    type: d?.type || 'MEMBER'
                  });
                } else {
                  out.push({ id: r.id || 'unknown', name: 'Deleted user', email: '', type: 'MEMBER' });
                }
                continue;
              } catch (e) {
                // if getDoc failed (not a real ref), we'll fall back below
                console.warn('getTeamMembersDetails: getDoc(r) failed, falling back', e);
              }
            }

            // If object has id property but no path, assume it's just an id -> students collection
            if ('id' in r && typeof r.id === 'string') {
              const docRef = doc(db, 'students', r.id);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                const d = snap.data();
                out.push({
                  id: snap.id,
                  name: d?.name || d?.displayName || 'No Name',
                  email: d?.email || '',
                  type: d?.type || 'MEMBER'
                });
              } else {
                out.push({ id: r.id, name: 'Deleted user', email: '', type: 'MEMBER' });
              }
              continue;
            }
          }

          // Unknown object shape -> stringify as id
          out.push({ id: JSON.stringify(r), name: 'Unknown', email: '', type: 'MEMBER' });
          continue;
        }

        // Fallback for unexpected types
        out.push({ id: String(r), name: 'Unknown', email: '', type: 'MEMBER' });

      } catch (err) {
        console.error('Error fetching a team member entry', err);
      }
    }

    return out;
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
        try {
          // teamData.teamLeader might be a string path or DocumentReference
          const leaderRef = ensureDocRef(teamData.teamLeader) || teamData.teamLeader;
          const leaderDoc = await getDoc(leaderRef);
          if (leaderDoc.exists()) {
            const studentData = leaderDoc.data();
            leaderData = {
              name: studentData?.name || "N/A",
              email: studentData?.email || "N/A",
            };
            leaderSubgroup = studentData?.subgroup || "N/A";
          }
        } catch (e) {
          console.warn('getAllTeamsForFaculty: could not fetch leader info', e);
        }
      }

      // Normalize members to array for frontend usage
      let members = teamData.teamMembers ?? [];
      if (!Array.isArray(members) && typeof members === 'object' && members !== null) {
        members = Object.values(members);
      }

      teams.push({
        id: teamDoc.id,
        name: teamData.teamName,
        members,
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
