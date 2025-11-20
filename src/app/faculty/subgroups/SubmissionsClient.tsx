// src/app/faculty/submissions/SubmissionsClient.tsx
'use client';

import { ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import Link from 'next/link';
import { useState } from 'react';

// --- Types ---
interface Team {
  id: string;
  name: string;
  subgroup: { name: string };
}

interface GroupedTeams {
  [subgroupName: string]: Team[];
}

interface SubmissionsClientProps {
  initialGroupedTeams: GroupedTeams;
  initialUserName: string;
}

export default function SubmissionsClient({
  initialGroupedTeams,
  initialUserName,
}: SubmissionsClientProps) {
  const [groupedTeams] = useState<GroupedTeams>(initialGroupedTeams);
  const [userName] = useState(initialUserName);

  const hasGroups = Object.keys(groupedTeams).length > 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="Submissions Management" userRole={userName} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Nav tabs */}
        <div className="flex gap-4 mb-6">
          <Link
            href="/faculty/dashboard"
            className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Overview
          </Link>
          <Link
            href="/faculty/assignments"
            className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Assignments
          </Link>
          <Link
            href="/faculty/submissions"
            className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium"
          >
            Submissions
          </Link>
        </div>

        {/* Subgroup cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(groupedTeams).map(([groupName, teamsInGroup]) => (
            <div
              key={groupName}
              className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden"
            >
              <div className="bg-red-800 px-6 py-4">
                <h3 className="text-xl font-bold text-white">{groupName}</h3>
                <p className="text-red-100 text-sm">
                  {teamsInGroup.length} Teams
                </p>
              </div>

              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {teamsInGroup.map((team) => (
                    <Link
                      key={team.id}
                      href={`/faculty/team/${team.id}`}
                      className="w-full text-left px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center justify-between transition-colors"
                    >
                      <span className="text-gray-800 font-medium">
                        {team.name}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                  ))}

                  {teamsInGroup.length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center py-4">
                      No teams in this subgroup yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!hasGroups && (
            <div className="md:col-span-3 bg-white border-2 border-gray-300 rounded-xl p-12 text-center">
              <p className="text-gray-500">
                No teams found for your subgroups.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
