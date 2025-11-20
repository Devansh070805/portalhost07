// src/services/faculty.js (or wherever you keep firebase logic)
import { db } from '@/config/firebase'; 
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * 1. Fetches the logged-in faculty's assigned subgroups.
 * 2. Fetches ONLY projects belonging to those subgroups (Optimization).
 */
export const getFacultyFilteredProjects = async (facultyEmail) => {
  try {
    // Step A: Get Faculty's Subgroups (e.g., ["3Q15", "3C24"])
    const facultyRef = collection(db, 'faculty');
    const facultyQuery = query(facultyRef, where('email', '==', facultyEmail));
    const facultySnapshot = await getDocs(facultyQuery);

    if (facultySnapshot.empty) return [];

    const facultyData = facultySnapshot.docs[0].data();
    const subgroups = facultyData.subgroupsUndertaking || [];

    if (subgroups.length === 0) return [];

    // Step B: Fetch Projects ONLY for these subgroups
    // Firestore 'in' query allows up to 10 items in the array.
    const projectsRef = collection(db, 'projects');
    const projectsQuery = query(projectsRef, where('subgroup', 'in', subgroups));
    
    const projectsSnapshot = await getDocs(projectsQuery);
    console.log(projectsSnapshot)

    return projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

  } catch (error) {
    console.error('Error fetching filtered projects:', error);
    return [];
  }
};