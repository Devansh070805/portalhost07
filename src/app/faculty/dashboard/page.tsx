// src/app/faculty/dashboard/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAllProjectsForFacultyDashboard } from '../../../../services/projects';
import { getAllTeamsForFaculty } from '../../../../services/teams';
import { getReportsForFaculty } from '../../../../services/inbox';
import { getSubmissionSettings } from '../../../../services/settings';

import FacultyDashboardClient from './FacultyDashboardClient';
import { useReducer } from 'react';

// ---- TYPES (mirror your client-side ones, but kept minimal here) ----
interface SanitizedProject {
  id: string;
  title: string;
  description?: string;
  status: 'ASSIGNED' | 'UNASSIGNED' | 'COMPLETED' | 'BLOCKED_LINK';
  team: {
    id: string | null;
    name: string;
    leader: { id?: string; name: string; email: string };
    subgroup: { name: string };
  };
  deployedLink?: string;
  githubLink?: string;
}

interface SanitizedTeam {
  id: string;
  name: string;
  leader: { id: string; name: string; email: string };
  subgroup?: { name: string };
  members: any[];
}

interface SanitizedSubmissionSettings {
  allowsSubmission: boolean;
  // number = timestamp ms since epoch; null = no deadline
  deadline: number | null;
}

// Very loose type for reports to avoid fighting TS here
type SanitizedReport = any;

// ---- HELPERS ----

async function getFacultyContext() {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get('userEmail')?.value || '';
  const userName = cookieStore.get('userName')?.value || 'Faculty';
  const userType = cookieStore.get('userType')?.value || '';

  return { userEmail, userName, userType };
}

// ---- UTIL: FULL SAFE SERIALIZER ----
const safeJson = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value?.toDate) return value.toDate().toISOString(); // Timestamp → ISO
      if (value?.id && value?.path) return value.id;           // DocRef → id
      return value;
    })
  );

// ---- SANITIZERS ----
const sanitizeProject = (p: any) => safeJson({
  id: p.id,
  title: p.title,
  description: p.description,
  status: p.status,
  team: p.team,
  deployedLink: p.deployedLink,
  githubLink: p.githubLink,
});

const sanitizeTeam = (t: any) => safeJson({
  id: t.id,
  name: t.name,
  leader: t.leader,
  subgroup: t.subgroup,
  members: t.members,
});

const sanitizeReport = (r: any) => safeJson(r);

const sanitizeSubmissionSettings = (s: any) => {
  const deadline = s?.deadline?.toDate?.() ? s.deadline.toDate().getTime() : null;
  return safeJson({
    allowsSubmission: s?.allowsSubmission ?? true,
    deadline,
  });
};


// ---- PAGE ----

export default async function FacultyDashboardPage() {
  const { userEmail, userName, userType } = await getFacultyContext();

  // Basic guard: if not faculty / no email, you can redirect to login
  if (!userEmail || userType !== 'faculty') {
    // You can also show an error card instead of redirect if you prefer
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border-2 border-red-300 rounded-xl px-8 py-6 shadow">
          <h1 className="text-xl font-bold text-red-800 mb-2">
            Faculty session not found
          </h1>
          <p className="text-gray-700">Please log in again as faculty.</p>
        </div>
      </div>
    );
  }

  // Fetch everything on the server in parallel
  const [rawProjects, rawTeams, rawReports, rawSettings] = await Promise.all([
    getAllProjectsForFacultyDashboard(userEmail),
    getAllTeamsForFaculty(userEmail),
    getReportsForFaculty(userEmail),
    getSubmissionSettings(userEmail)
  ]);

  const projects: SanitizedProject[] = (rawProjects || []).map(sanitizeProject);
  const teams: SanitizedTeam[] = (rawTeams || []).map(sanitizeTeam);
  const reports: SanitizedReport[] = (rawReports || []).map(sanitizeReport);
  const submissionSettings: SanitizedSubmissionSettings =
    sanitizeSubmissionSettings(rawSettings || {});

  return (
    <FacultyDashboardClient
      initialProjects={projects}
      initialTeams={teams}
      initialInboxReports={reports}
      initialSubmissionSettings={submissionSettings}
      initialUserName={userName}
      userEmail={userEmail}
    />
  );
}
