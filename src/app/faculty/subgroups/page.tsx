// src/app/faculty/submissions/page.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';

import { getAllTeamsForFaculty } from '../../../../services/teams';
import SubmissionsClient from './SubmissionsClient';

// --- Types ---
interface Team {
  id: string;
  name: string;
  subgroup: { name: string };
}

interface GroupedTeams {
  [subgroupName: string]: Team[];
}

// Sanitize team to ensure it's plain JSON
const sanitizeTeam = (t: any): Team => ({
  id: t.id || '',
  name: t.name || 'Unknown Team',
  subgroup: {
    name: t.subgroup?.name || 'Unknown Subgroup',
  },
});

async function getFacultyContext() {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get('userEmail')?.value || '';
  const userName = cookieStore.get('userName')?.value || 'Coordinator';
  const userType = cookieStore.get('userType')?.value || '';

  return { userEmail, userName, userType };
}

export default async function SubmissionsPage() {
  const { userEmail, userName, userType } = await getFacultyContext();

  if (!userEmail || userType !== 'faculty') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border-2 border-red-300 rounded-xl px-8 py-6 shadow">
          <h1 className="text-xl font-bold text-red-800 mb-2">
            Faculty session not found
          </h1>
          <p className="text-gray-700 mb-4">Please log in again as faculty.</p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-red-800 text-white rounded-lg font-medium hover:bg-red-900"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Fetch teams for this faculty
  const rawTeams = await getAllTeamsForFaculty(userEmail);
  const teams: Team[] = (rawTeams || []).map(sanitizeTeam);

  // Group teams by subgroup on the server (plain object, JSON-safe)
  const groups: GroupedTeams = {};

  for (const team of teams) {
    const subgroupName =
      team.subgroup?.name && team.subgroup.name !== 'N/A'
        ? team.subgroup.name
        : 'Unknown Subgroup';

    if (!groups[subgroupName]) {
      groups[subgroupName] = [];
    }
    groups[subgroupName].push(team);
  }

  // Sort teams inside each subgroup
  Object.keys(groups).forEach((groupName) => {
    groups[groupName].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Sort subgroup cards alphabetically
  const sortedGroupNames = Object.keys(groups).sort();
  const sortedGroupedTeams: GroupedTeams = {};
  sortedGroupNames.forEach((name) => {
    sortedGroupedTeams[name] = groups[name];
  });

  return (
    <SubmissionsClient
      initialGroupedTeams={sortedGroupedTeams}
      initialUserName={userName}
    />
  );
}
