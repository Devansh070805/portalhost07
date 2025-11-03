// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { 
  FileText, CheckCircle, Clock, Users, ExternalLink, 
  ClipboardCheck, Layers, Trash2,
  Inbox as InboxIcon,
  AlertTriangle
} from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Import our new components and service functions
import InviteHandler from '@/components/InviteHandler';
import TeamManagement from '@/components/TeamManagement';
import { getTeamDetails } from '../../../services/teams'; // Adjust path
import { getPendingInvites } from '../../../services/invites'; // Adjust path
import { 
  getProjectsByTeam, 
  getProjectsAssignedToTeam, 
  deleteProject 
} from '../../../services/projects'; // Adjust path
import { getTestCaseStats } from '../../../services/testcases'; // Adjust path

// --- (CHANGE 1) ---
// --- Make sure you are IMPORTING the Report type from Inbox.tsx ---
import Inbox, { type Report } from '@/components/Inbox'; // Adjust path as needed
import {
    getReportsForUploadingTeam,
    getReportsForTestingTeam
} from '../../../services/inbox'; // Adjust path as needed

const PROJECT_SUBMISSION_LIMIT = 1;

// --- Define full types ---
interface Project {
  id: string;
  title: string;
  status: string; 
  deployedLink?: string;
  githubLink?: string;
  submissionTime: any; 
  testCases?: any[];
}

interface Team {
  id: string;
  teamName: string;
  teamLeader: any; // Ref
  teamMembers: any[]; // Array of Refs
}

interface Assignment {
  id: string; 
  project: { 
    id: string;
    title: string;
  };
  originalTeam: { 
    id: string;
    teamName: string;
  };
  status: string; 
}

// --- (CHANGE 2) ---
// --- DELETE any local 'interface Report' that was here ---
// This was the cause of your error.

export default function StudentDashboard() {
  const router = useRouter();

  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [studentType, setStudentType] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamDetails, setTeamDetails] = useState<Team | null>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  
  // --- Inbox State (This now correctly uses the imported Report type) ---
  const [uploadingReports, setUploadingReports] = useState<Report[]>([]);
  const [testingReports, setTestingReports] = useState<Report[]>([]);

  // Stats state
  const [stats, setStats] = useState({
    totalProjectsSubmitted: 0,
    teamMembers: 0,
    activeTestingProjects: 0, 
    totalTestCases: 0,
    testCasesPassed: 0,
    testCasesFailed: 0,
    testCasesPending: 0,
  });

  const [loading, setLoading] = useState(true);

  // Auth/Router useEffect (Unchanged)
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedUserEmail = localStorage.getItem('userEmail');
    const storedUserName = localStorage.getItem('userName') || 'Student';
    const storedStudentType = localStorage.getItem('studentType');
    const storedTeamId = localStorage.getItem('teamId');

    setUserId(storedUserId);
    setUserEmail(storedUserEmail);
    setUserName(storedUserName);
    setStudentType(storedStudentType);
    setTeamId(storedTeamId);

    if (!storedUserId || !storedStudentType) {
      router.push('/login');
      return;
    }
    if (storedStudentType === 'LEADER' && !storedTeamId) {
      router.push('/create-team');
      return;
    }
    if (storedStudentType === 'MEMBER' && !storedTeamId) {
      if (storedUserEmail) {
        getPendingInvites(storedUserEmail).then((invites) => {
          setPendingInvites(invites);
          setLoading(false);
        });
      }
      return;
    }
    if (storedTeamId) {
      fetchDashboardData(storedTeamId);
    }
  }, [router]); 

  // Data Fetching Function (Unchanged logic)
  const fetchDashboardData = async (teamId: string) => {
    setLoading(true);
    try {
        const [
            projectsSubmittedData, 
            teamData, 
            projectsAssignedData,
            uploadingReportsData,
            testingReportsData
        ] = await Promise.all([
            getProjectsByTeam(teamId),
            getTeamDetails(teamId),
            getProjectsAssignedToTeam(teamId),
            getReportsForUploadingTeam(teamId),
            getReportsForTestingTeam(teamId)
        ]);

        const submittedProjects = (projectsSubmittedData || []) as Project[];
        const teamInfo = teamData as Team;
        const assignments = (projectsAssignedData || []) as Assignment[]; 

        const activeAssignments = assignments.filter(a => a.status !== 'COMPLETED');

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
        
        // Set inbox state
        setUploadingReports(uploadingReportsData as Report[]);
        setTestingReports(testingReportsData as Report[]);
        
        setStats({
          totalProjectsSubmitted: submittedProjects.length,
          // ---
          // --- FIX #1: Removed the "+ 1" ---
          // ---
          teamMembers: teamInfo?.teamMembers?.length || 0,
          activeTestingProjects: activeAssignments.length, 
          totalTestCases: totalStats.total,
          testCasesPassed: totalStats.pass,
          testCasesFailed: totalStats.fail,
          testCasesPending: totalStats.pending,
        });     

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setStats({ 
            totalProjectsSubmitted: 0, teamMembers: 0, activeTestingProjects: 0,
            totalTestCases: 0, testCasesPassed: 0, testCasesFailed: 0, testCasesPending: 0
        });
    } finally {
        setLoading(false);
    }
  };

  // Delete Project Handler (Unchanged)
  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This will also delete all related testing assignments. This action cannot be undone.')) {
      try {
        await deleteProject(projectId);
        if (teamId) {
          fetchDashboardData(teamId);
        }
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  // Helper Functions (Unchanged)
const getStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'bg-green-100 text-green-700';
    case 'ASSIGNED': return 'bg-blue-100 text-blue-700';
    case 'UNASSIGNED': return 'bg-yellow-100 text-yellow-700';
    case 'BLOCKED_LINK': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'Completed';
    case 'ASSIGNED': return 'Assigned';
    case 'UNASSIGNED': return 'Unassigned';
    case 'BLOCKED_LINK': return 'Blocked';
    default: return status;
  }
};



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

  // Case 1: Member without a team (Unchanged)
  if (!teamId && studentType === 'MEMBER') {
    return (
      <AuthCheck requiredRole="student">
        <div className="min-h-screen bg-gray-100">
          <Header title="Student Dashboard" userRole={userName} />
          {userId && (
  <InviteHandler
    invites={pendingInvites}
    userId={userId}
    onAccepted={async (joinedTeamId?: string) => {
      // refresh pending invites for the invitee
      if (userEmail) {
        const refreshed = await getPendingInvites(userEmail);
        setPendingInvites(refreshed || []);
      }
      // if joined a team, set team state and load its dashboard data
      if (joinedTeamId) {
        setTeamId(joinedTeamId);
        localStorage.setItem('teamId', joinedTeamId);
        localStorage.setItem('studentType', 'MEMBER');
        await fetchDashboardData(joinedTeamId);
      }
    }}
  />
)}
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
            {/* Navigation Tabs (Unchanged) */}
            <div className="flex gap-4 mb-6">
              <Link href="/dashboard" className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium">
                Dashboard
              </Link>
              <Link href="/testing" className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50">
                Project Testing
              </Link>
            </div>

            {/* Stats Cards (Unchanged) */}
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

            {/* Inbox Section (Unchanged) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* --- Uploader Inbox --- */}
                <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                    <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-700" />
                            My Project Issues
                        </h2>
                        {uploadingReports.length > 0 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                                {uploadingReports.length}
                            </span>
                        )}
                    </div>
                    {/* THIS LINE (355) IS NOW CORRECT */}
                    <Inbox
                        role="uploader"
                        reports={uploadingReports}
                        onDataMutate={() => fetchDashboardData(teamId)}
                    />
                </div>

                {/* --- Tester Inbox --- */}
                 <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                    <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <InboxIcon className="w-5 h-5 text-blue-700" />
                            My Filed Reports
                        </h2>
                    </div>
                    {/* THIS LINE IS ALSO NOW CORRECT */}
                    <Inbox
                        role="tester"
                        reports={testingReports}
                        onDataMutate={() => fetchDashboardData(teamId)}
                    />
                </div>
            </div>
            {/* --- End of Inbox Section --- */}


            {/* Projects List (Unchanged) */}
            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm mb-8">
              <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">My Projects</h2>
                
                {studentType === 'LEADER' && (
                  projects.length < PROJECT_SUBMISSION_LIMIT ? (
                    <Link 
                      href="/submission"
                      className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium"
                    >
                      + Add New Project
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 bg-gray-400 text-white rounded-lg text-sm font-medium cursor-not-allowed"
                      title="You can only submit one project."
                    >
                      Project Limit Reached
                    </button>
                  )
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
                            </div>
                          </div>
                        </div>

                        {studentType === 'LEADER' && (
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            className="ml-4 p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors flex-shrink-0"
                            title="Delete Project"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Team Management (Unchanged) */}
            { teamDetails && (
              <TeamManagement 
                teamId={teamId}
                teamName={teamDetails.teamName}
                // @ts-ignore
                leaderId={teamDetails.teamLeader.id} 
                // ---
                // --- FIX #2: Pass the members array directly ---
                // ---
                teamMemberRefs={teamDetails.teamMembers}
                currentUserId={userId!}
              />
            )}

          </div>
        </div>
      </AuthCheck>
    );
  }

  // Fallback case (Unchanged)
  return (
    <AuthCheck requiredRole="student">
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    </AuthCheck>
  );
}