'use client';

import { useEffect, useState } from 'react';
import { 
  FileText, Users, ExternalLink, 
  ClipboardCheck, Layers, Trash2,
  Inbox as InboxIcon,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Import our new components and service functions
import InviteHandler from '@/components/InviteHandler';
import TeamManagement from '@/components/TeamManagement';
import { getTeamDetails } from '../../../services/teams';
import { getPendingInvites } from '../../../services/invites';
import { 
  getProjectsByTeam, 
  getProjectsAssignedToTeam, 
  deleteProject 
} from '../../../services/projects';
import { getTestCaseStats } from '../../../services/testcases';

import { Timestamp, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebaseConfig';

// Inbox + reports
import Inbox, { type Report } from '@/components/Inbox';
import {
  getReportsForUploadingTeam,
  getReportsForTestingTeam
} from '../../../services/inbox';

const PROJECT_SUBMISSION_LIMIT = 1;
const ADMIN_EMAIL = 'portaltesting733@gmail.com';

// --- Types ---
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
  
  // Inbox State
  const [uploadingReports, setUploadingReports] = useState<Report[]>([]);
  const [testingReports, setTestingReports] = useState<Report[]>([]);

  // Deadline state
  const [submissionDeadline, setSubmissionDeadline] = useState<Timestamp | null>(null);
  const [allowsSubmissions, setAllowsSubmissions] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [isDeadlineSoon, setIsDeadlineSoon] = useState(false);

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

  // ---------------- AUTH / INITIAL LOAD ----------------
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
      fetchDashboardData(storedTeamId, storedUserId);
    }
  }, [router]); 

  // ---------------- COUNTDOWN TIMER ----------------
  useEffect(() => {
    if (!submissionDeadline) {
      setCountdown('');
      setIsDeadlineSoon(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const deadlineTime = submissionDeadline.toDate().getTime();
      const diff = deadlineTime - now;

      if (diff <= 0) {
        setCountdown('Deadline has passed.');
        setIsDeadlineSoon(true);
        clearInterval(interval);
        return;
      }

      if (diff < 3600 * 1000) { // Less than 1 hour
        setIsDeadlineSoon(true);
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      let countdownString = '';
      if (d > 0) countdownString += `${d}d `;
      if (h > 0 || d > 0) countdownString += `${h}h `;
      countdownString += `${m}m ${s}s`;

      setCountdown(countdownString);
    }, 1000);

    return () => clearInterval(interval);
  }, [submissionDeadline]);

  // ---------------- DATA FETCH ----------------
  const fetchDashboardData = async (teamId: string, studentId?: string | null) => {
    setLoading(true);
    try {
      const [
        projectsSubmittedData,
        teamData,
        projectsAssignedData,
        uploadingReportsData,
        testingReportsData,
      ] = await Promise.all([
        getProjectsByTeam(teamId),
        getTeamDetails(teamId),
        getProjectsAssignedToTeam(teamId),
        getReportsForUploadingTeam(teamId),
        getReportsForTestingTeam(teamId),
      ]);

      const submittedProjects = (projectsSubmittedData || []) as Project[];
      const teamInfo = teamData as Team;
      const assignments = (projectsAssignedData || []) as Assignment[];

      // ---- Determine faculty email from student's subgroup ----
      let facultyEmailForTeam: string | null = null;

      if (studentId) {
        const studentSnap = await getDoc(doc(db, 'students', studentId));
        if (studentSnap.exists()) {
          const studentData = studentSnap.data() as any;
          const subgroup = studentData?.subgroup;

          if (subgroup) {
            const facQ = query(
              collection(db, 'faculty'),
              where('subgroupsUndertaking', 'array-contains', subgroup)
            );
            const facSnap = await getDocs(facQ);

            if (!facSnap.empty) {
              const facData = facSnap.docs[0].data() as any;
              facultyEmailForTeam = facData?.email || null;
            }
          }
        }
      }

      // ---- Scan settings collection for faculty + admin ----
      let chosenDeadline: Timestamp | null = null;
      let chosenAllows = true;

      const settingsSnap = await getDocs(collection(db, 'settings'));
      let facultySettings: any = null;
      let adminSettings: any = null;

      settingsSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const fe = data.facultyEmail || null;

        if (facultyEmailForTeam && fe === facultyEmailForTeam) {
          facultySettings = data;
        }
        if (fe === ADMIN_EMAIL) {
          adminSettings = data;
        }
      });

      if (facultySettings && facultySettings.deadline) {
        chosenDeadline = facultySettings.deadline as Timestamp;
        chosenAllows =
          typeof facultySettings.allowsSubmission === 'boolean'
            ? facultySettings.allowsSubmission
            : true;
      } else if (adminSettings && adminSettings.deadline) {
        chosenDeadline = adminSettings.deadline as Timestamp;
        chosenAllows =
          typeof adminSettings.allowsSubmission === 'boolean'
            ? adminSettings.allowsSubmission
            : true;
      } else {
        // No deadline found for faculty or admin
        chosenDeadline = null;
        chosenAllows = true;
      }

      const activeAssignments = assignments.filter(
        (a) => a.status !== 'COMPLETED'
      );

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

      setSubmissionDeadline(chosenDeadline);
      setAllowsSubmissions(chosenAllows);

      setUploadingReports(uploadingReportsData as Report[]);
      setTestingReports(testingReportsData as Report[]);
      setStats({
        totalProjectsSubmitted: submittedProjects.length,
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
        totalProjectsSubmitted: 0,
        teamMembers: 0,
        activeTestingProjects: 0,
        totalTestCases: 0,
        testCasesPassed: 0,
        testCasesFailed: 0,
        testCasesPending: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- DELETE PROJECT ----------------
  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This will also delete all related testing assignments. This action cannot be undone.')) {
      try {
        await deleteProject(projectId);
        if (teamId) {
          fetchDashboardData(teamId, userId);
        }
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  // ---------------- HELPERS ----------------
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

  const isDeadlinePassed =
    submissionDeadline && Date.now() > submissionDeadline.toDate().getTime();
  const isSubmissionAllowed = allowsSubmissions && !isDeadlinePassed;
  const canSubmit =
    studentType === 'LEADER' &&
    projects.length < PROJECT_SUBMISSION_LIMIT &&
    isSubmissionAllowed;
  
  const getDisabledTitle = () => {
    if (projects.length >= PROJECT_SUBMISSION_LIMIT) return 'You can only submit one project.';
    if (!allowsSubmissions && !isDeadlinePassed) return 'Submissions are currently closed by faculty.';
    if (isDeadlinePassed) return 'The submission deadline has passed.';
    return 'Add a new project';
  };

  // ---------------- RENDER ----------------
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

  // Case 1: Member without a team
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
                if (userEmail) {
                  const refreshed = await getPendingInvites(userEmail);
                  setPendingInvites(refreshed || []);
                }
                if (joinedTeamId) {
                  setTeamId(joinedTeamId);
                  localStorage.setItem('teamId', joinedTeamId);
                  localStorage.setItem('studentType', 'MEMBER');
                  await fetchDashboardData(joinedTeamId, userId);
                }
              }}
            />
          )}
        </div>
      </AuthCheck>
    );
  }

  // Case 2: User with a team
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

            {submissionDeadline && (
              <div className={`mb-6 p-4 border-2 rounded-xl flex items-center justify-center gap-3 ${isDeadlineSoon ? 'bg-red-50 border-red-200' : 'bg-white border-gray-300'}`}>
                <Calendar className={`w-5 h-5 ${isDeadlineSoon ? 'text-red-700' : 'text-red-800'}`} />
                <span className="font-semibold text-gray-800">Submission Deadline:</span>
                <span className={`font-bold ${isDeadlineSoon ? 'text-red-700' : 'text-gray-900'}`}>
                  {countdown}
                </span>
              </div>
            )}
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                <Layers className="w-8 h-8 text-red-800 mb-3" />
                <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalProjectsSubmitted}</h3>
                <p className="text-gray-600">Projects Submitted</p>
              </div>
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
              <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                <Users className="w-8 h-8 text-red-800 mb-3" />
                <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.teamMembers}</h3>
                <p className="text-gray-600">Team Members</p>
              </div>
            </div>

            {/* Inbox Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
                <Inbox
                  role="uploader"
                  reports={uploadingReports}
                  onDataMutate={() => teamId && fetchDashboardData(teamId, userId)}
                />
              </div>

              <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <InboxIcon className="w-5 h-5 text-blue-700" />
                    My Filed Reports
                  </h2>
                </div>
                <Inbox
                  role="tester"
                  reports={testingReports}
                  onDataMutate={() => teamId && fetchDashboardData(teamId, userId)}
                />
              </div>
            </div>

            {/* Projects List */}
            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm mb-8">
              <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">My Projects</h2>
                
                {studentType === 'LEADER' && (
                  canSubmit ? (
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
                      title={getDisabledTitle()}
                    >
                      {projects.length >= PROJECT_SUBMISSION_LIMIT ? 'Project Limit Reached' : 'Submissions Closed'}
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
                            <div className="flex flex-wrap gap-3">
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
                              
                              <Link
                                href={`/reports/${project.id}`}
                                className="px-4 py-2 bg-red-800 hover:bg-red-800 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                title="View report options for this project"
                              >
                                <FileText className="w-4 h-4" />
                                View Report
                              </Link>
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

            {/* Team Management */}
            { teamDetails && (
              <TeamManagement 
                teamId={teamId}
                teamName={teamDetails.teamName}
                // @ts-ignore
                leaderId={teamDetails.teamLeader.id} 
                teamMemberRefs={teamDetails.teamMembers}
                currentUserId={userId!}
              />
            )}

          </div>
        </div>
      </AuthCheck>
    );
  }

  // Fallback
  return (
    <AuthCheck requiredRole="student">
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    </AuthCheck>
  );
}
