'use client';

import { useEffect, useState } from 'react';
import { Users, FileText, CheckCircle, Clock, ChevronRight, Mail, X } from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';

// --- IMPORT YOUR SERVICE FUNCTIONS ---
import { getAllProjectsForFacultyDashboard } from '../../../../services/projects'; // Adjust path
import { getAllTeamsForFaculty } from '../../../../services/teams'; // Adjust path
import { getTeamMembersDetails } from '../../../../services/teams'; // Import function to get member details

console.log("FacultyDashboard component file is being read.");

// --- INTERFACES ---
interface Project {
    id: string;
    title: string;
    status: string; // PENDING, ASSIGNED, COMPLETED 
    team: {
        id: string | null;
        name: string;
        leader: { name: string; email: string; };
        subgroup: { name: string; };
    };
    deployedLink?: string;
    githubLink?: string;
    testAssignment?: { assignedTo: { name: string } }; // For quick view
}

interface Team {
    id: string;
    name: string;
    leader: { name: string; email: string; };
    subgroup?: { name: string; };
    members: any[]; // Array of DocumentReferences
}

interface StudentMember {
    id: string;
    name: string;
    email: string;
}

// --- MAIN COMPONENT ---
export default function FacultyDashboard() {
  console.log("1. FacultyDashboard function is EXECUTING.");

    const [projects, setProjects] = useState<Project[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [stats, setStats] = useState({
        totalProjects: 0,
        projectsCompleted: 0, // Based on project status 'COMPLETED'
        totalTeams: 0,
    });
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');

    console.log("2. State has been initialized.");

    // State for viewing details
    const [selectedTeamMembers, setSelectedTeamMembers] = useState<StudentMember[] | null>(null);
    const [selectedProjectDetails, setSelectedProjectDetails] = useState<Project | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
      console.log("useEffect hook has FIRED.");
        const name = localStorage.getItem('userName') || 'Faculty';
        setUserName(name);
        fetchData();
    }, []);

    const fetchData = async () => {
      console.log("fetchData function called!");
        setLoading(true);
        try {
            const [projectsData, teamsData] = await Promise.all([
                getAllProjectsForFacultyDashboard(),
                getAllTeamsForFaculty()
            ]);

            const fetchedProjects = (projectsData || []) as Project[];
            const fetchedTeams = (teamsData || []) as Team[];

            console.log("Fetched Projects:", fetchedProjects);

            setProjects(fetchedProjects);
            setTeams(fetchedTeams);

            // --- FIX: Update calculation to include "TESTING" status ---
            // The stat card says "Projects Tested/Completed"
            const testedOrCompleted = fetchedProjects.filter(
                (p) => p.status === 'COMPLETED' || p.status === 'TESTING'
            ).length;

            console.log(testedOrCompleted + "fss")

            setStats({
                totalProjects: fetchedProjects.length,
                // --- Use the new calculation ---
                projectsCompleted: testedOrCompleted,
                totalTeams: fetchedTeams.length,
            });
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers for Viewing Details ---
    const handleViewTeamMembers = async (team: Team) => {
        setSelectedProjectDetails(null); // Close project details if open
        setLoadingDetails(true);
        setSelectedTeamMembers(null); // Clear previous members
        try {
            const memberDetails = await getTeamMembersDetails(team.members);
            setSelectedTeamMembers(memberDetails as StudentMember[]);
        } catch (error) {
            console.error("Error fetching team members:", error);
            // Optionally show an error message to the user
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleViewProjectDetails = (project: Project) => {
        setSelectedTeamMembers(null); // Close team members if open
        setSelectedProjectDetails(project);
    };

    const closeDetails = () => {
        setSelectedTeamMembers(null);
        setSelectedProjectDetails(null);
    }

    console.log("3. Handlers have been defined.");
    // --- Loading State ---
    if (loading) {
      console.log("4. Component is RETURNING (loading state).");
        return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    {/* ... (loading spinner UI) ... */}
                    <div className="text-center"> <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div> <p className="mt-4 text-gray-600">Loading Dashboard...</p> </div>
                </div>
        );
    }

    console.log("5. Component is RETURNING (main content).");
    // --- Main Render ---
    return (
        <AuthCheck requiredRole="faculty">
            <div className="min-h-screen bg-gray-100">
                <Header title="Faculty Dashboard" userRole={userName} />

                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Navigation Tabs */}
                    <div className="flex gap-4 mb-6">
                        <Link href="/faculty/dashboard" className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium"> Overview </Link>
                        <Link href="/faculty/assignments" className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"> Assignments </Link>
                        <Link href="/faculty/subgroups" className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"> Subgroups </Link>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm"> <FileText className="w-8 h-8 text-red-800 mb-3" /> <h3 className="text-2xl font-bold text-gray-800">{stats.totalProjects}</h3> <p className="text-gray-600">Total Projects Submitted</p> </div>
                        <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                            <CheckCircle className="w-8 h-8 text-green-600 mb-3" />
                            {/* This h3 now correctly reflects the label "Projects Tested/Completed" */}
                            <h3 className="text-2xl font-bold text-green-600">{stats.projectsCompleted}</h3>
                            <p className="text-gray-600">Projects Tested/Completed</p>
                        </div>
                        <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm"> <Users className="w-8 h-8 text-red-800 mb-3" /> <h3 className="text-2xl font-bold text-gray-800">{stats.totalTeams}</h3> <p className="text-gray-600">Total Teams Registered</p> </div>
                    </div>

                    {/* Main Content Area - Teams and Projects */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* All Teams Section */}
                        <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b-2 border-gray-300"> <h2 className="text-xl font-bold text-gray-800">All Teams ({teams.length})</h2> </div>
                            <div className="max-h-[600px] overflow-y-auto"> {/* Added scroll */}
                                {teams.length === 0 ? (
                                    <p className="p-6 text-gray-500">No teams registered yet.</p>
                                ) : (
                                    <ul className="divide-y divide-gray-300">
                                        {teams.map((team) => (
                                            <li key={team.id} className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-gray-800">{team.name}</p>
                                                    <p className="text-sm text-gray-600">Leader: {team.leader.name} {team.subgroup?.name ? `(${team.subgroup.name})` : ''}</p>
                                                </div>
                                                <button onClick={() => handleViewTeamMembers(team)} className="text-red-800 hover:text-red-900"> <ChevronRight className="w-5 h-5" /> </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* All Projects Section */}
                        <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b-2 border-gray-300"> <h2 className="text-xl font-bold text-gray-800">All Projects ({projects.length})</h2> </div>
                             <div className="max-h-[600px] overflow-y-auto"> {/* Added scroll */}
                                {projects.length === 0 ? (
                                    <p className="p-6 text-gray-500">No projects submitted yet.</p>
                                ) : (
                                    <ul className="divide-y divide-gray-300">
                                        {projects.map((project) => (
                                            <li key={project.id} className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-gray-800">{project.title}</p>
                                                    <p className="text-sm text-gray-600">Team: {project.team.name} ({project.status})</p>
                                                </div>
                                                <button onClick={() => handleViewProjectDetails(project)} className="text-red-800 hover:text-red-900"> <ChevronRight className="w-5 h-5" /> </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Details Side Panel/Modal (Simple Inline Version) */}
                    {(selectedTeamMembers || selectedProjectDetails || loadingDetails) && (
                        <div className="mt-8 bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm relative">
                             <button onClick={closeDetails} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"> <X className="w-6 h-6" /> </button>

                            {loadingDetails && <p>Loading details...</p>}

                            {/* Team Member Details */}
                            {selectedTeamMembers && (
                                <>
                                    <h3 className="text-lg font-bold mb-4">Team Members</h3>
                                    <ul className="space-y-2">
                                        {selectedTeamMembers.map(member => (
                                            <li key={member.id} className="flex items-center gap-2 text-sm">
                                                <Users className="w-4 h-4 text-gray-500"/>
                                                <span>{member.name} ({member.email})</span>
                                                 {/* You can add a check here if member.id === teamLeader.id */}
                                            </li>
        ))}
                                    </ul>
                                </>
                            )}

                            {/* Project Details */}
                            {selectedProjectDetails && (
                                <>
                                    <h3 className="text-lg font-bold mb-2">{selectedProjectDetails.title}</h3>
                                    <p className="text-sm text-gray-600 mb-1">Team: {selectedProjectDetails.team.name}</p>
                                    <p className="text-sm text-gray-600 mb-1">Status: {selectedProjectDetails.status}</p>
                                    <p className="text-sm text-gray-600 mb-3">Leader: {selectedProjectDetails.team.leader.name} ({selectedProjectDetails.team.leader.email})</p>
                                    {/* Add more project details here: description, links etc. */}
                                    <div className="flex gap-3 mt-4">
                                        {selectedProjectDetails.deployedLink && <a href={selectedProjectDetails.deployedLink} target="_blank" className="link-button text-xs">View Live</a>}
                                        {selectedProjectDetails.githubLink && <a href={selectedProjectDetails.githubLink} target="_blank" className="link-button text-xs">GitHub</a>}
                                         {/* Link to assignment page could go here */}
                                         <Link href="/faculty/assignments" className="link-button text-xs bg-red-100 text-red-800 border-red-300 hover:bg-red-200">Manage Assignment</Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </AuthCheck>
    );
     // Add base styles if needed: e.g., .link-button { @apply px-3 py-1 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-200 inline-flex items-center gap-1; }
}
