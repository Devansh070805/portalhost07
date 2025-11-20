import { cookies } from 'next/headers';
import { getAllProjectsForFaculty } from '../../../../services/projects';
import { getAllTeamsForFaculty } from '../../../../services/teams';
import AssignmentsClient from './AssignmentsClient';

async function getFacultyContext() {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get('userEmail')?.value || '';
  const userName = cookieStore.get('userName')?.value || 'Faculty';
  return { userEmail, userName };
}

// --- SANITIZATION HELPERS ---
// These are critical to prevent "RangeError: Maximum call stack size exceeded"
// They strip out circular references (like Firestore refs) and ensure plain JSON.

const sanitizeTeam = (t: any) => ({
  id: t.id || '',
  name: t.name || 'Unknown Team',
  subgroup: { 
    name: t.subgroup?.name || 'N/A' 
  }
});

const sanitizeProject = (p: any) => ({
  id: p.id || '',
  title: p.title || 'Untitled Project',
  status: p.status || 'Pending',
  team: {
    id: p.team?.id || null,
    name: p.team?.name || 'Unknown',
    subgroup: { 
      name: p.team?.subgroup?.name || 'N/A' 
    }
  },
  // Map assignments to clean objects, removing any deep parent links
  testAssignments: Array.isArray(p.testAssignments) ? p.testAssignments.map((a: any) => ({
    id: a.id || undefined,
    assignedTo: {
      id: a.assignedTo?.id || '',
      name: a.assignedTo?.name || ''
    },
    isProposed: !!a.isProposed,
    status: a.status || ''
  })) : [],
  deployedLink: p.deployedLink || '',
  githubLink: p.githubLink || ''
});

export default async function AssignmentsPage() {
  const { userEmail, userName } = await getFacultyContext();

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border-2 border-red-300 rounded-xl px-8 py-6 shadow">
          <h1 className="text-xl font-bold text-red-800 mb-2">
            Faculty email not found
          </h1>
          <p className="text-gray-700">
            Please log in again.
          </p>
        </div>
      </div>
    );
  }

  // Fetch raw data

  const [rawProjects, rawTeams] = await Promise.all([
    getAllProjectsForFaculty(userEmail),
    getAllTeamsForFaculty(userEmail),
  ]);


  // Clean the data before passing to client
  const projects = (rawProjects || []).map(sanitizeProject);
  const teams = (rawTeams || []).map(sanitizeTeam);

  return (
    <AssignmentsClient
      initialProjects={projects}
      initialTeams={teams}
      initialUserName={userName}
      userEmail={userEmail}
    />
  );
}