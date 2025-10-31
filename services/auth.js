import { db, auth } from './firebaseConfig.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore"; 

/**
 * Creates a new user in Firebase Auth and a corresponding
 * document in the 'students' collection.
 */
export async function createStudent(name, email, type, password, subgroup) {
  try {
    // Step 1: Create the user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("User created in Auth, UID:", user.uid);

    // Step 2: Create the student document in the 'students' collection
    await setDoc(doc(db, "students", user.uid), {
      name: name,
      email: email,
      type: type, // "MEMBER" or "LEADER"
      subgroup: subgroup
      // NO PASSWORD IS STORED HERE!
    });

    console.log("Student document created in Firestore with ID:", user.uid);
    return user.uid; // Return the new user's ID

  } catch (error) {
    console.error("Error creating student: ", error.message);
    // Return null or throw error so the component knows it failed
    return null; 
  }
}

/**
 * Creates a new user in Firebase Auth and a corresponding
 * document in the 'faculty' collection.
 */
export async function createFaculty(name, email, subgroups, password) {
  try {
    // Step 1: Create the user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("Faculty user created in Auth, UID:", user.uid);

    // Step 2: Create the faculty document in the 'faculty' collection
    await setDoc(doc(db, "faculty", user.uid), {
      name: name,
      email: email,
      subgroupsUndertaking: subgroups || [] // Default to empty array
    });

    console.log("Faculty document created in Firestore with ID:", user.uid);
    return user.uid; // Return the new user's ID

  } catch (error) {
    console.error("Error creating faculty: ", error.message);
    return null;
  }
}

/**
 * Signs in a user with email and password.
 * After successful auth, it fetches their profile from Firestore.
 */
export async function loginUser(email, password, userType) { // userType is 'student' or 'faculty'
  try {
    // 1. Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Determine which collection to read from
    // <<< FIX: Map 'student' to 'students' (plural) >>>
    const collectionName = userType === 'student' ? 'students' : 'faculty';
    
    // 3. Get the user's profile document from Firestore
    const userDocRef = doc(db, collectionName, user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // This should not happen if registration is correct
      await signOut(auth); // Sign them out just in case
      throw new Error("User profile not found in database."); 
    }

    // 4. Return all the data your component needs
    const userData = userDoc.data();
    
    return {
      id: user.uid,
      email: user.email,
      name: userData.name,
      role: userType === 'faculty' ? 'FACULTY' : 'STUDENT', // Match your login page logic
      type: userData.type, // This will be 'LEADER' or 'MEMBER' for students
      teamId: userData.teamId || null, 
      teamName: userData.teamName || null, 
    };

  } catch (error) {
    console.error("Login Error: ", error.message);
    // Check for common auth errors
    if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
      throw new Error("Invalid email or password.");
    }
    throw error; // Re-throw other errors
  }
}


export async function logoutUser() {
  try {
    await signOut(auth);
    
    // Clear all session data from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userType');
      localStorage.removeItem('studentType');
      localStorage.removeItem('teamId');
      localStorage.removeItem('isAuthenticated');
    }
    
    console.log("User signed out and localStorage cleared.");
  } catch (error) {
    console.error("Error signing out: ", error.message);
  }
}