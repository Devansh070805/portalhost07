// src/app/faculty/dashboard/FacultyDashboardClient.tsx
'use client';

import { useMemo, useState } from 'react';
import {
  Users,
  FileText,
  CheckCircle,
  ChevronRight,
  Search,
  Inbox as InboxIcon,
  XCircle,
  Calendar,
} from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Inbox, { type Report } from '@/components/Inbox';
import DatePicker from 'react-datepicker';

import {
  getSubmissionSettings,
  setSubmissionDeadline,
  clearSubmissionDeadline,
  toggleSubmissions,
} from '../../../../services/settings';

// ---- TYPES (match server + previous component) ----

interface Project {
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

interface Team {
  id: string;
  name: string;
  leader: { id: string; name: string; email: string };
  subgroup?: { name: string };
  members: any[];
}

interface SubmissionSettingsClient {
  allowsSubmission: boolean;
  // timestamp in ms, or null
  deadline: number | null;
}

interface FacultyDashboardClientProps {
  initialProjects: Project[];
  initialTeams: Team[];
  initialInboxReports: Report[] | any[];
  initialSubmissionSettings: SubmissionSettingsClient;
  initialUserName: string;
  userEmail: string;
}

// ---- MAIN CLIENT COMPONENT ----

export default function FacultyDashboardClient({
  initialProjects,
  initialTeams,
  initialInboxReports,
  initialSubmissionSettings,
  initialUserName,
  userEmail,
}: FacultyDashboardClientProps) {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [userName] = useState(initialUserName);
  const [inboxReports, setInboxReports] = useState<Report[] | any[]>(
    initialInboxReports
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'inbox'>('overview');

  // Submission settings
  const [submissionSettings, setSubmissionSettings] =
    useState<SubmissionSettingsClient>(initialSubmissionSettings);

  const [selectedDeadline, setSelectedDeadline] = useState<Date | null>(
    initialSubmissionSettings.deadline
      ? new Date(initialSubmissionSettings.deadline)
      : null
  );
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  const [stats, setStats] = useState(() => {
    const testedOrCompletedCount = initialProjects.filter(
      (p) => p.status === 'COMPLETED'
    ).length;

    return {
      totalProjects: initialProjects.length,
      testedOrCompleted: testedOrCompletedCount,
      totalTeams: initialTeams.length,
    };
  });

  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [testingStatusSearchQuery, setTestingStatusSearchQuery] = useState('');

  const [activeStatusTab, setActiveStatusTab] = useState<
    'COMPLETED' | 'ASSIGNED' | 'UNASSIGNED' | 'BLOCKED_LINK'
  >('COMPLETED');

  const [projectsCompleted] = useState<Project[]>(
    initialProjects.filter((p) => p.status === 'COMPLETED')
  );
  const [projectsAssigned] = useState<Project[]>(
    initialProjects.filter((p) => p.status === 'ASSIGNED')
  );
  const [projectsUnassigned] = useState<Project[]>(
    initialProjects.filter((p) => p.status === 'UNASSIGNED')
  );
  const [projectsReported] = useState<Project[]>(
    initialProjects.filter((p) => p.status === 'BLOCKED_LINK')
  );

  // ----- FILTER HELPERS -----

  const filterProjects = (projectList: Project[], query: string) => {
    if (!query) return projectList;
    const lowerQuery = query.toLowerCase();
    return projectList.filter(
      (project) =>
        project.title.toLowerCase().includes(lowerQuery) ||
        project.team.name.toLowerCase().includes(lowerQuery)
    );
  };

  const filteredTeams = useMemo(() => {
    if (!teamSearchQuery) return teams;
    const q = teamSearchQuery.toLowerCase();
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(q) ||
        team.leader.name.toLowerCase().includes(q)
    );
  }, [teams, teamSearchQuery]);

  const filteredAllProjects = useMemo(
    () => filterProjects(projects, projectSearchQuery),
    [projects, projectSearchQuery]
  );
  const filteredProjectsCompleted = useMemo(
    () => filterProjects(projectsCompleted, testingStatusSearchQuery),
    [projectsCompleted, testingStatusSearchQuery]
  );
  const filteredProjectsAssigned = useMemo(
    () => filterProjects(projectsAssigned, testingStatusSearchQuery),
    [projectsAssigned, testingStatusSearchQuery]
  );
  const filteredProjectsUnassigned = useMemo(
    () => filterProjects(projectsUnassigned, testingStatusSearchQuery),
    [projectsUnassigned, testingStatusSearchQuery]
  );
  const filteredProjectsReported = useMemo(
    () => filterProjects(projectsReported, testingStatusSearchQuery),
    [projectsReported, testingStatusSearchQuery]
  );

  // ----- SUBMISSION SETTINGS HANDLERS -----

  const normalizeSettings = (s: any): SubmissionSettingsClient => ({
    allowsSubmission: !!s?.allowsSubmission,
    deadline:
      s?.deadline && typeof s.deadline.toDate === 'function'
        ? s.deadline.toDate().getTime()
        : null,
  });

  const refetchSettings = async () => {
    const settingsData = await getSubmissionSettings(userEmail);
    const normalized = normalizeSettings(settingsData);
    setSubmissionSettings(normalized);

    if (settingsData.deadline && typeof settingsData.deadline.toDate === 'function') {
      setSelectedDeadline(settingsData.deadline.toDate());
    } else {
      setSelectedDeadline(null);
    }
  };

  const handleSetDeadline = async () => {
    if (!selectedDeadline) return;
    setIsSettingsLoading(true);
    await setSubmissionDeadline(selectedDeadline, userEmail);
    await refetchSettings();
    setIsSettingsLoading(false);
  };

  const handleClearDeadline = async () => {
    setIsSettingsLoading(true);
    await clearSubmissionDeadline(userEmail);
    await refetchSettings();
    setIsSettingsLoading(false);
  };

  const handleToggleSubmissions = async () => {
    setIsSettingsLoading(true);
    await toggleSubmissions(!submissionSettings.allowsSubmission, userEmail);
    await refetchSettings();
    setIsSettingsLoading(false);
  };

  const formattedDeadline = useMemo(() => {
    if (!submissionSettings.deadline) return null;
    return new Date(submissionSettings.deadline).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [submissionSettings.deadline]);

  // When Inbox mutates data (e.g. resolving reports), just re-SSR the page
  const handleInboxMutate = () => {
    router.refresh();
  };

  return (
    <AuthCheck requiredRole="faculty">
      <div className="min-h-screen bg-gray-100 pb-20">
        <Header title="Faculty Dashboard" userRole={userName} />

        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === 'overview'
                  ? 'bg-red-800 text-white'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Overview
            </button>
            <Link
              href="/faculty/assignments"
              className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Assignments
            </Link>
            <Link
              href="/faculty/subgroups"
              className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Subgroups
            </Link>
          </div>

          {/* Inbox icon */}
          <button
            onClick={() => setActiveTab('inbox')}
            className={`relative p-3 rounded-full border-2 border-gray-300 hover:bg-gray-50 ${
              activeTab === 'inbox'
                ? 'bg-red-800 text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            <InboxIcon className="w-5 h-5" />
            {inboxReports.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                {inboxReports.length}
              </span>
            )}
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-6">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                  <FileText className="w-8 h-8 text-red-800 mb-3" />
                  <h3 className="text-2xl font-bold text-gray-800">
                    {stats.totalProjects}
                  </h3>
                  <p className="text-gray-600">Total Projects Submitted</p>
                </div>
                <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                  <CheckCircle className="w-8 h-8 text-green-600 mb-3" />
                  <h3 className="text-2xl font-bold text-green-600">
                    {stats.testedOrCompleted}
                  </h3>
                  <p className="text-gray-600">Projects Tested/Completed</p>
                </div>
                <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                  <Users className="w-8 h-8 text-red-800 mb-3" />
                  <h3 className="text-2xl font-bold text-gray-800">
                    {stats.totalTeams}
                  </h3>
                  <p className="text-gray-600">Total Teams Registered</p>
                </div>
              </div>

              {/* Submission settings */}
              <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b-2 border-gray-300 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-800">
                    Project Submission Settings
                  </h2>
                </div>
                <div className="p-6 space-y-6">
                  {/* Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        Allow Submissions
                      </h3>
                      <p className="text-sm text-gray-600">
                        Manually open or close all project submissions.
                      </p>
                    </div>
                    <button
                      onClick={handleToggleSubmissions}
                      disabled={isSettingsLoading}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 ${
                        submissionSettings.allowsSubmission
                          ? 'bg-red-800'
                          : 'bg-gray-400'
                      } ${isSettingsLoading ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          submissionSettings.allowsSubmission
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Deadline */}
                  <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Set Deadline
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Current Deadline:
                      {formattedDeadline ? (
                        <strong className="text-red-800 ml-2">
                          {formattedDeadline}
                        </strong>
                      ) : (
                        <span className="text-gray-500 ml-2">None set</span>
                      )}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-grow">
                        <DatePicker
                          selected={selectedDeadline}
                          onChange={(date: Date | null) => setSelectedDeadline(date)}
                          showTimeSelect
                          dateFormat="MMMM d, yyyy h:mm aa"
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-gray-700"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSetDeadline}
                          disabled={isSettingsLoading}
                          className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium hover:bg-red-900 disabled:bg-gray-400 flex-grow sm:flex-grow-0"
                        >
                          <Calendar className="w-4 h-4 inline mr-2" />
                          Set
                        </button>
                        <button
                          onClick={handleClearDeadline}
                          disabled={
                            isSettingsLoading || !submissionSettings.deadline
                          }
                          className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 flex-grow sm:flex-grow-0"
                        >
                          <XCircle className="w-4 h-4 inline mr-2" />
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Testing Status */}
              <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b-2 border-gray-300">
                  <h2 className="text-xl font-bold text-gray-800">
                    Testing Status
                  </h2>
                </div>

                <div className="p-4 border-b-2 border-gray-300">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search projects in active tab"
                      value={testingStatusSearchQuery}
                      onChange={(e) =>
                        setTestingStatusSearchQuery(e.target.value)
                      }
                      className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-gray-700"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex border-b border-gray-300 flex-wrap">
                  <StatusTab
                    label="Testing Completed"
                    value="COMPLETED"
                    count={filteredProjectsCompleted.length}
                    activeTab={activeStatusTab}
                    setActiveTab={setActiveStatusTab}
                  />
                  <StatusTab
                    label="Assigned"
                    value="ASSIGNED"
                    count={filteredProjectsAssigned.length}
                    activeTab={activeStatusTab}
                    setActiveTab={setActiveStatusTab}
                  />
                  <StatusTab
                    label="Not Yet Assigned"
                    value="UNASSIGNED"
                    count={filteredProjectsUnassigned.length}
                    activeTab={activeStatusTab}
                    setActiveTab={setActiveStatusTab}
                  />
                  <StatusTab
                    label="Reported Projects"
                    value="BLOCKED_LINK"
                    count={filteredProjectsReported.length}
                    activeTab={activeStatusTab}
                    setActiveTab={setActiveStatusTab}
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {activeStatusTab === 'COMPLETED' && (
                    <ProjectList projects={filteredProjectsCompleted} />
                  )}
                  {activeStatusTab === 'ASSIGNED' && (
                    <ProjectList projects={filteredProjectsAssigned} />
                  )}
                  {activeStatusTab === 'UNASSIGNED' && (
                    <ProjectList projects={filteredProjectsUnassigned} />
                  )}
                  {activeStatusTab === 'BLOCKED_LINK' && (
                    <ProjectList projects={filteredProjectsReported} />
                  )}
                </div>
              </div>

              {/* All Teams & All Projects */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Teams */}
                <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b-2 border-gray-300">
                    <h2 className="text-xl font-bold text-gray-800">
                      All Teams ({filteredTeams.length})
                    </h2>
                  </div>
                  <div className="p-4 border-b-2 border-gray-300">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search teams by name or leader"
                        value={teamSearchQuery}
                        onChange={(e) => setTeamSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-gray-700"
                      />
                      <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {filteredTeams.length === 0 ? (
                      <p className="p-6 text-gray-500">
                        {teamSearchQuery
                          ? 'No teams match your search.'
                          : 'No teams registered yet.'}
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-300">
                        {filteredTeams.map((team) => (
                          <li
                            key={team.id}
                            className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-semibold text-gray-800">
                                {team.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                Leader: {team.leader.name}{' '}
                                {team.subgroup?.name
                                  ? `(${team.subgroup.name})`
                                  : ''}
                              </p>
                            </div>
                            <Link
                              href={`/faculty/team/${team.id}`}
                              className="text-red-800 hover:text-red-900"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Projects */}
                <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b-2 border-gray-300">
                    <h2 className="text-xl font-bold text-gray-800">
                      All Projects ({filteredAllProjects.length})
                    </h2>
                  </div>
                  <div className="p-4 border-b-2 border-gray-300">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search projects by title or team"
                        value={projectSearchQuery}
                        onChange={(e) =>
                          setProjectSearchQuery(e.target.value)
                        }
                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-gray-700"
                      />
                      <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {filteredAllProjects.length === 0 ? (
                      <p className="p-6 text-gray-500">
                        {projectSearchQuery
                          ? 'No projects match your search.'
                          : 'No projects submitted yet.'}
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-300">
                        {filteredAllProjects.map((project) => (
                          <li
                            key={project.id}
                            className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-semibold text-gray-800">
                                {project.title}
                              </p>
                              <p className="text-sm text-gray-600">
                                Team: {project.team.name} ({project.status})
                              </p>
                            </div>
                            <Link
                              href={`/faculty/team/${project.team.id}`}
                              className="text-red-800 hover:text-red-900"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inbox' && (
            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b-2 border-gray-300">
                <h2 className="text-xl font-bold text-gray-800">
                  Inbox: Project Link Reports
                </h2>
              </div>
              <Inbox
                role="faculty"
                reports={inboxReports as Report[]}
                onDataMutate={handleInboxMutate}
              />
            </div>
          )}
        </div>
      </div>
    </AuthCheck>
  );
}

// ---- SUB COMPONENTS ----

function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0)
    return (
      <p className="p-6 text-gray-500 text-center">
        No projects in this category.
      </p>
    );
  return (
    <ul className="divide-y divide-gray-300">
      {projects.map((project) => (
        <li
          key={project.id}
          className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center"
        >
          <div>
            <p className="font-semibold text-gray-800">{project.title}</p>
            <p className="text-sm text-gray-600">Team: {project.team.name}</p>
          </div>
          <Link
            href={`/faculty/team/${project.team.id}`}
            className="text-red-800 hover:text-red-900"
          >
            View Details <ChevronRight className="w-5 h-5 inline" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatusTab({ label, value, count, activeTab, setActiveTab }: any) {
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`flex-1 p-4 font-semibold min-w-[150px] ${
        activeTab === value
          ? 'text-red-800 border-b-4 border-red-800'
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label} ({count})
    </button>
  );
}
