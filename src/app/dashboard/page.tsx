// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { FileText, CheckCircle, Clock, Users, ExternalLink, ClipboardCheck, Layers } from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Import our new components and service functions
import InviteHandler from '@/components/InviteHandler';
import TeamManagement from '@/components/TeamManagement';
import ProjectDetailsModal from '@/components/ProjectDetailsModal'; 
import { getTeamDetails } from '../../../services/teams'; // Adjust path
import { getPendingInvites } from '../../../services/invites'; // Adjust path
import { getProjectsByTeam, getProjectsAssignedToTeam } from '../../../services/projects'; // Adjust path
import { getTestCaseStats } from 'services/testcases';

// Define full types
interface Project {
  id: string;
  title: string;
  status: string; // Assuming status comes from the doc
  deployedLink?: string;
  githubLink?: string;
  submissionTime: any; // Firestore timestamp
  testCases?: any[];
}

interface Team {
  id: string;
  teamName: string;
  teamLeader: any; // Ref
  teamMembers: any[]; // Array of Refs
}

interface Assignment {
  id: string; // Assignment ID
  project: { // Project being tested
    id: string;
    title: string;
    // ... add other project fields if needed by UI ...
  };
  originalTeam: { // Team that submitted the project
    id: string;
    teamName: string;
    // ... add other team fields if needed ...
  };
  status: string; // Status of the assignment (e.g., 'ASSIGNED', 'COMPLETED')
}

export default function StudentDashboard() {
  const router = useRouter();

  // New state to manage auth and roles
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [studentType, setStudentType] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  // State for data
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamDetails, setTeamDetails] = useState<Team | null>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  
  // --- FIXED: Updated stats state definition ---
  const [stats, setStats] = useState({
    totalProjectsSubmitted: 0,
    teamMembers: 0,
    activeTestingProjects: 0, // Replaced assignedProjectTitle
    totalTestCases: 0,
    testCasesPassed: 0,
    testCasesFailed: 0,
    testCasesPending: 0,
  });

  const [loading, setLoading] = useState(true);

  // This useEffect is now the main "router"
  useEffect(() => {
    // 1. Get all user data from localStorage
    const storedUserId = localStorage.getItem('userId');
    const storedUserEmail = localStorage.getItem('userEmail');
    const storedUserName = localStorage.getItem('userName') || 'Student';
    const storedStudentType = localStorage.getItem('studentType'); // 'LEADER' or 'MEMBER'
    const storedTeamId = localStorage.getItem('teamId');

    // 2. Set essential state
    setUserId(storedUserId);
    setUserEmail(storedUserEmail);
    setUserName(storedUserName);
    setStudentType(storedStudentType);
    setTeamId(storedTeamId);

    // 3. Main Logic Branch
    if (!storedUserId || !storedStudentType) {
      // This shouldn't happen if AuthCheck is working, but it's safe
      router.push('/login');
      return;
    }

    if (storedStudentType === 'LEADER' && !storedTeamId) {
      // Leader without a team must create one
      router.push('/create-team');
      return;
    }

    if (storedStudentType === 'MEMBER' && !storedTeamId) {
      // Member without a team: check for invites
      if (storedUserEmail) {
        getPendingInvites(storedUserEmail).then((invites) => {
          setPendingInvites(invites);
          setLoading(false);
        });
      }
      return;
    }

    if (storedTeamId) {
      // User is on a team, fetch all dashboard data
      fetchDashboardData(storedTeamId);
    }
  }, [router]); // Re-run if router changes

  // New function to fetch all data once we know user is on a team
  const fetchDashboardData = async (teamId: string) => {
    try {
        // Fetch Projects SUBMITTED BY team, Team Details, and Projects ASSIGNED TO team
        const [projectsSubmittedData, teamData, projectsAssignedData] = await Promise.all([
            getProjectsByTeam(teamId),
            getTeamDetails(teamId),
            getProjectsAssignedToTeam(teamId) // Fetch assignments for this team
        ]);

        const submittedProjects = (projectsSubmittedData || []) as Project[];
        const teamInfo = teamData as Team;
        const assignments = (projectsAssignedData || []) as Assignment[]; // Cast assignments

        // Find the *single* active assignment (first one that's not 'COMPLETED')
        const activeAssignments = assignments.filter(a => a.status !== 'COMPLETED');

        // [Original commented code removed for brevity]

        let totalStats = { total: 0, pass: 0, fail: 0, pending: 0 };
        for (const assignment of activeAssignments) {
            const stats = await getTestCaseStats(assignment.id);
            totalStats.total += stats.total;
            totalStats.pass += stats.pass;
            totalStats.fail += stats.fail;
            totalStats.pending += stats.pending;
        }
        setProjects(submittedProjects);
        setTeamDetails(teamInfo);

        // --- FIXED: Removed stray line "activeTestingProjects: 0," ---

        // [Original commented setStats removed for brevity]
        
        setStats({
          totalProjectsSubmitted: submittedProjects.length,
          teamMembers: teamInfo?.teamMembers?.length || 0,
          activeTestingProjects: activeAssignments.length, // Store the count
          totalTestCases: totalStats.total,
          testCasesPassed: totalStats.pass,
          testCasesFailed: totalStats.fail,
          testCasesPending: totalStats.pending,
        });     

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // --- FIXED: Updated stats reset to match new shape ---
        setStats({ // Reset stats on error
            totalProjectsSubmitted: 0, teamMembers: 0, activeTestingProjects: 0,
            totalTestCases: 0, testCasesPassed: 0, testCasesFailed: 0, testCasesPending: 0
        });
    } finally {
        setLoading(false);
    }
};

  // --- Helper Functions (unchanged) ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'TESTING': return 'bg-blue-100 text-blue-700';
      case 'ASSIGNED': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Completed';
      case 'TESTING': return 'Testing';
      case 'ASSIGNED': return 'Assigned';
      case 'PENDING': return 'Pending';
      default: return status;
    }
  };
  // --- End of Helper Functions ---


  // --- Render Logic ---

  if (loading) {
    return (
      <AuthCheck requiredRole="student">
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading Dashboard...</p>
          </div>
        </div>
      </AuthCheck>
    );
  }

  // Case 1: Member without a team (show invite handler)
  if (!teamId && studentType === 'MEMBER') {
    return (
      <AuthCheck requiredRole="student">
        <div className="min-h-screen bg-gray-100">
          <Header title="Student Dashboard" userRole={userName} />
          {userId && <InviteHandler invites={pendingInvites} userId={userId} />}
        </div>
      </AuthCheck>
    );
  }

  // Case 2: User with a team (show the full dashboard)
  if (teamId) {
    return (
      <AuthCheck requiredRole="student">
        <div className="min-h-screen bg-gray-100">
          <Header title="Student Dashboard" userRole={userName} />
          
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Navigation Tabs */}
            <div className="flex gap-4 mb-6">
              <Link href="/dashboard" className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium">
                Dashboard
              </Link>
              <Link href="/testing" className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50">
                Project Testing
              </Link>
            </div>

            {/* Stats Cards - Updated for Single Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Total Projects Submitted */}
              <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                <Layers className="w-8 h-8 text-red-800 mb-3" />
                <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalProjectsSubmitted}</h3>
                <p className="text-gray-600">Projects Submitted</p>
              </div>
              {/* Assigned Project Test Cases */}
              <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm col-span-1 md:col-span-2">
                <ClipboardCheck className="w-8 h-8 text-red-800 mb-3" />
                <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate" title={`Testing ${stats.activeTestingProjects} projects`}>
                  Testing: {stats.activeTestingProjects} Project(s)
                </h3>
                <div className="flex justify-around items-center text-center mt-3 pt-3 border-t border-gray-200">
                  <div>
                    <p className="text-2xl font-bold text-gray-700">{stats.totalTestCases}</p>
                    <p className="text-xs text-gray-500">Total Cases</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{stats.testCasesPassed}</p>
                    <p className="text-xs text-gray-500">Passed</p>
                  </div>
                   <div>
                    <p className="text-2xl font-bold text-red-600">{stats.testCasesFailed}</p>
                    <p className="text-xs text-gray-500">Failed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{stats.testCasesPending}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                </div>
              </div>
              {/* Team Members */}
              <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                <Users className="w-8 h-8 text-red-800 mb-3" />
                <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.teamMembers}</h3>
                <p className="text-gray-600">Team Members</p>
              </div>
            </div>

            {/* Projects List */}
            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">My Projects</h2>
                
                {studentType === 'LEADER' && (
                  <Link 
                    href="/submission"
                    className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium"
                  >
                    + Add New Project
                  </Link>
                )}
              </div>
              
              {projects.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No Projects Yet</h3>
                  <p className="text-gray-500 mb-6">
                    {studentType === 'LEADER' 
                      ? "Get started by submitting your first project" 
                      : "Your team leader has not submitted any projects yet."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-300">
                  {projects.map((project) => (
                    <div key={project.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <FileText className="w-12 h-12 text-red-800 mt-1" />
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{project.title}</h3>
                            <p className="text-gray-600 text-sm mb-3">
                              {/* @ts-ignore */}
                              Submitted on {new Date(project.submissionTime?.toDate()).toLocaleDateString()}
                            </p>
                            <div className="flex flex-wrap gap-4 mb-3">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
                                {getStatusText(project.status)}
                              </span>
                              {project.testCases && (
                                <span className="text-gray-600 text-sm">
                                  {project.testCases.length} test cases
                                </span>
                              )}
                            </div>
                            <div className="flex gap-3">
                              {project.deployedLink && (
                                <a
                                  href={project.deployedLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  View Live
                                </a>
                              )}
                              {project.githubLink && (
                                <a
                                  href={project.githubLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                                >
                                  GitHub
                                </a>
                              )}
                              {/* <button className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium">
                                View Details
                              </button> */}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* <<< THIS IS THE CORRECTED BLOCK >>> */}
            { teamDetails && (
              <TeamManagement 
                teamId={teamId}
                teamName={teamDetails.teamName}
                // Pass the leader's ID (which is a DocumentReference)
                leaderId={teamDetails.teamLeader.id} 
                // Pass the array of member references
                teamMemberRefs={teamDetails.teamMembers}
                currentUserId={userId!}
              />
            )}
            {/* <<< END OF CORRECTED BLOCK >>> */}

          </div>
        </div>
      </AuthCheck>
    );
  }

  // Fallback case (shouldn't be reached, but good to have)
  return (
    <AuthCheck requiredRole="student">
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    </AuthCheck>
  );
}