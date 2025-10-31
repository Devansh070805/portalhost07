'use client';

import { useEffect, useState } from 'react';
import { Users, Mail, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';

// --- IMPORT YOUR NEW SERVICE FUNCTION ---
import { getAllTeamsForFaculty } from '../../../../services/teams'; // Adjust path

// --- UPDATED TEAM INTERFACE ---
interface Team {
  id: string;
  name: string;
  members: string[];
  leader: {
    name: string;
    email: string;
  };
  subgroup?: {
    name: string;
  };
  project?: {
    id: string;
    title: string;
    status: string;
  };
}

export default function FacultyTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'all' | 'subgroup'>('all');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const name = localStorage.getItem('userName') || 'Faculty';
    setUserName(name);
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      // --- FETCH FROM FIREBASE, NOT API ---
      const data = await getAllTeamsForFaculty();
      // @ts-ignore
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedTeams = groupBy === 'subgroup' 
    ? teams.reduce((acc, team) => {
        const subgroupName = team.subgroup?.name || 'No Subgroup';
        if (!acc[subgroupName]) {
          acc[subgroupName] = [];
        }
        acc[subgroupName].push(team);
        return acc;
      }, {} as Record<string, Team[]>)
    : { 'All Teams': teams };

  if (loading) {
    // ... Loading UI is fine ...
    return (
      <AuthCheck requiredRole="faculty">
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          ...
        </div>
      </AuthCheck>
    );
  }

  return (
    <AuthCheck requiredRole="faculty">
      <div className="min-h-screen bg-gray-100">
        <Header title="All Teams" userRole={userName} />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* ... Back Button and Actions are fine ... */}
          <div className="flex items-center justify-between mb-6">...</div>

          {/* Stats - Now dynamic */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
              <Users className="w-8 h-8 text-red-800 mb-3" />
              <h3 className="text-2xl font-bold text-gray-800">{teams.length}</h3>
              <p className="text-gray-600">Total Teams</p>
            </div>
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
              <Users className="w-8 h-8 text-green-600 mb-3" />
              <h3 className="text-2xl font-bold text-green-600">
                {teams.filter(t => t.project).length}
              </h3>
              <p className="text-gray-600">Teams with Projects</p>
            </div>
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
              <Users className="w-8 h-8 text-yellow-600 mb-3" />
              <h3 className="text-2xl font-bold text-yellow-600">
                {teams.filter(t => !t.project).length}
              </h3>
              <p className="text-gray-600">Teams without Projects</p>
            </div>
          </div>

          {/* Teams List (Data is now live) */}
          {Object.entries(groupedTeams).map(([groupName, groupTeams]) => (
            <div key={groupName} className="mb-8">
              {/* ... (grouping UI is fine) ... */}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupTeams.map((team) => (
                  <div
                    key={team.id}
                    className="bg-white border-2 border-gray-300 rounded-xl p-6 hover:shadow-md transition-shadow"
                  >
                    {/* ... (team card UI is fine) ... */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-red-800" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-800 truncate">
                          {team.name}
                        </h3>
                        {team.subgroup && (
                          <p className="text-sm text-gray-600">
                            {team.subgroup.name}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* ... (team details, leader, members, project) ... */}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {teams.length === 0 && (
            // ... (No teams UI is fine) ...
            <div className="bg-white border-2 border-gray-300 rounded-xl p-12 text-center">...</div>
          )}
        </div>
      </div>
    </AuthCheck>
  );
}