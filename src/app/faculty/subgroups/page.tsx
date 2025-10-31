'use client';

import { ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// --- 1. IMPORT the service function ---
import { getAllTeamsForFaculty } from '../../../../services/teams'; // Adjust path as needed

// --- 2. DEFINE types for fetched data ---
interface Team {
    id: string;
    name: string;
    subgroup: { name: string; }; // Expecting subgroup name from the service function
}

// Type for the grouped structure
interface GroupedTeams {
    [subgroupName: string]: Team[]; // Key is subgroup name, value is array of teams
}

export default function SubgroupsPage() {
    // --- 3. ADD state for loading and grouped teams ---
    const [groupedTeams, setGroupedTeams] = useState<GroupedTeams>({});
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState(''); // Keep user name state

     useEffect(() => {
        // Get user name (same as before)
        const name = localStorage.getItem('userName') || 'Coordinator';
        setUserName(name);
        fetchAndGroupTeams(); // Call the data fetching function
    }, []);

    // --- 4. CREATE function to fetch and process data ---
    const fetchAndGroupTeams = async () => {
        setLoading(true);
        try {
            const teamsData = await getAllTeamsForFaculty();
            const teams = (teamsData || []) as Team[];

            // Group teams by subgroup
            const groups: GroupedTeams = {};
            teams.forEach(team => {
                // Use 'Unknown Subgroup' if subgroup name is missing/invalid
                const subgroupName = team.subgroup?.name && team.subgroup.name !== 'N/A'
                    ? `${team.subgroup.name}`
                    : 'Unknown Subgroup';

                if (!groups[subgroupName]) {
                    groups[subgroupName] = []; // Initialize if group doesn't exist
                }
                groups[subgroupName].push(team);
            });

            // Sort teams within each group alphabetically by name
            for (const groupName in groups) {
                groups[groupName].sort((a, b) => a.name.localeCompare(b.name));
            }

            // Sort the groups themselves alphabetically by name
            const sortedGroupNames = Object.keys(groups).sort();
            const sortedGroupedTeams: GroupedTeams = {};
            sortedGroupNames.forEach(name => {
                sortedGroupedTeams[name] = groups[name];
            });


            setGroupedTeams(sortedGroupedTeams);

        } catch (error) {
            console.error("Error fetching or grouping teams:", error);
            // Handle error state if needed
        } finally {
            setLoading(false);
        }
    };

    // --- Loading State ---
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                 <div className="text-center"> <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div> <p className="mt-4 text-gray-600">Loading Subgroups...</p> </div>
            </div>
        );
    }

    // --- 5. UPDATE JSX to use fetched data ---
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Pass dynamic user name to Header */}
            <Header title="Subgroups Management" userRole={userName} />

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Navigation Tabs (No change needed) */}
                <div className="flex gap-4 mb-6">
                    <Link href="/faculty/dashboard" className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"> Overview </Link>
                    <Link href="/faculty/assignments" className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"> Assignments </Link>
                    <Link href="/faculty/subgroups" className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium"> Subgroups </Link>
                </div>

                {/* Subgroups Grid - Map over Object.entries */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.entries(groupedTeams).map(([groupName, teamsInGroup]) => (
                        <div key={groupName} className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-red-800 px-6 py-4">
                                {/* Display dynamic group name */}
                                <h3 className="text-xl font-bold text-white">{groupName}</h3>
                                {/* Display dynamic team count */}
                                <p className="text-red-100 text-sm">{teamsInGroup.length} Teams</p>
                            </div>
                            <div className="p-6 max-h-96 overflow-y-auto"> {/* Added scroll for long team lists */}
                                <div className="space-y-3">
                                    {teamsInGroup.map((team) => (
                                        <Link
                                            key={team.id}
                                            // <<< FIX: Use team ID for the link >>>
                                            href={`/faculty/team/${team.id}`} // Assuming you have a page like this
                                            className="w-full text-left px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center justify-between transition-colors"
                                        >
                                            <span className="text-gray-800 font-medium">{team.name}</span>
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </Link>
                                    ))}
                                    {teamsInGroup.length === 0 && (
                                         <p className="text-sm text-gray-500 italic text-center py-4">No teams in this subgroup yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* Handle case where no teams exist at all */}
                     {Object.keys(groupedTeams).length === 0 && !loading && (
                         <div className="md:col-span-3 bg-white border-2 border-gray-300 rounded-xl p-12 text-center">
                             <p className="text-gray-500">No teams found.</p>
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
}