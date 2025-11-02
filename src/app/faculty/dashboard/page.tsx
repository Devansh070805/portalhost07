'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    Users,
    FileText,
    CheckCircle,
    ChevronRight,
    Search,
    Inbox as InboxIcon
} from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';

import { getAllProjectsForFacultyDashboard } from '../../../../services/projects';
import { getAllTeamsForFaculty } from '../../../../services/teams';
import { getReportsForFaculty } from '../../../../services/inbox';
import Inbox, { type Report } from '@/components/Inbox';

console.log("FacultyDashboard component file is being read.");

// --- INTERFACES ---
interface Project {
    id: string;
    title: string;
    description?: string;
    status: 'ASSIGNED' | 'UNASSIGNED' | 'COMPLETED' | 'BLOCKED_LINK';
    team: {
        id: string | null;
        name: string;
        leader: { id?: string; name: string; email: string; }; // id is optional
        subgroup: { name: string; };
    };
    deployedLink?: string;
    githubLink?: string;
}

interface Team {
    id: string;
    name: string;
    leader: { id: string; name: string; email: string; };
    subgroup?: { name: string; };
    members: any[];
}

// --- MAIN COMPONENT ---
export default function FacultyDashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [inboxReports, setInboxReports] = useState<Report[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'inbox'>('overview');

    const [stats, setStats] = useState({
        totalProjects: 0,
        testedOrCompleted: 0,
        totalTeams: 0,
    });

    const [teamSearchQuery, setTeamSearchQuery] = useState('');
    const [projectSearchQuery, setProjectSearchQuery] = useState('');
    const [testingStatusSearchQuery, setTestingStatusSearchQuery] = useState('');

    const [activeStatusTab, setActiveStatusTab] = useState<'COMPLETED' | 'ASSIGNED' | 'UNASSIGNED' | 'BLOCKED_LINK'>('COMPLETED');
    const [projectsCompleted, setProjectsCompleted] = useState<Project[]>([]);
    const [projectsAssigned, setProjectsAssigned] = useState<Project[]>([]);
    const [projectsUnassigned, setProjectsUnassigned] = useState<Project[]>([]);
    const [projectsReported, setProjectsReported] = useState<Project[]>([]);

    useEffect(() => {
        const name = localStorage.getItem('userName') || 'Faculty';
        setUserName(name);
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [projectsData, teamsData, reportsData] = await Promise.all([
                getAllProjectsForFacultyDashboard(),
                getAllTeamsForFaculty(),
                getReportsForFaculty()
            ]);

            const fetchedProjects = (projectsData || []) as Project[];
            const fetchedTeams = (teamsData || []) as Team[];

            setProjects(fetchedProjects);
            setTeams(fetchedTeams);
            setInboxReports(reportsData as Report[]);

            const testedOrCompletedCount = fetchedProjects.filter(
                (p) => p.status === 'COMPLETED' 
            ).length;

            setStats({
                totalProjects: fetchedProjects.length,
                testedOrCompleted: testedOrCompletedCount,
                totalTeams: fetchedTeams.length,
            });

            setProjectsCompleted(fetchedProjects.filter(p => p.status === 'COMPLETED'));
            setProjectsAssigned(fetchedProjects.filter(p => p.status === 'ASSIGNED'));
            setProjectsUnassigned(fetchedProjects.filter(p => p.status === 'UNASSIGNED'));
            setProjectsReported(fetchedProjects.filter(p => p.status === 'BLOCKED_LINK'));
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterProjects = (projectList: Project[], query: string) => {
        if (!query) return projectList;
        const lowerQuery = query.toLowerCase();
        return projectList.filter(project =>
            project.title.toLowerCase().includes(lowerQuery) ||
            project.team.name.toLowerCase().includes(lowerQuery)
        );
    };

    const filteredTeams = useMemo(() => {
        if (!teamSearchQuery) return teams;
        const query = teamSearchQuery.toLowerCase();
        return teams.filter(team =>
            team.name.toLowerCase().includes(query) ||
            team.leader.name.toLowerCase().includes(query)
        );
    }, [teams, teamSearchQuery]);

    const filteredAllProjects = useMemo(() => filterProjects(projects, projectSearchQuery), [projects, projectSearchQuery]);
    const filteredProjectsCompleted = useMemo(() => filterProjects(projectsCompleted, testingStatusSearchQuery), [projectsCompleted, testingStatusSearchQuery]);
    const filteredProjectsAssigned = useMemo(() => filterProjects(projectsAssigned, testingStatusSearchQuery), [projectsAssigned, testingStatusSearchQuery]);
    const filteredProjectsUnassigned = useMemo(() => filterProjects(projectsUnassigned, testingStatusSearchQuery), [projectsUnassigned, testingStatusSearchQuery]);
    const filteredProjectsReported = useMemo(() => filterProjects(projectsReported, testingStatusSearchQuery), [projectsReported, testingStatusSearchQuery]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <AuthCheck requiredRole="faculty">
            <div className="min-h-screen bg-gray-100 pb-20">
                <Header title="Faculty Dashboard" userRole={userName} />

                <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center mb-6">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'overview' ? 'bg-red-800 text-white' : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'}`}
                        >
                            Overview
                        </button>
                        <Link href="/faculty/assignments" className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50">
                            Assignments
                        </Link>
                        <Link href="/faculty/subgroups" className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50">
                            Subgroups
                        </Link>
                    </div>

                    {/* Inbox icon on the right */}
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`relative p-3 rounded-full border-2 border-gray-300 hover:bg-gray-50 ${activeTab === 'inbox' ? 'bg-red-800 text-white' : 'bg-white text-gray-700'}`}
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
                            
                            {/* --- (RESTORED) STATS CARDS --- */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                                    <FileText className="w-8 h-8 text-red-800 mb-3" />
                                    <h3 className="text-2xl font-bold text-gray-800">{stats.totalProjects}</h3>
                                    <p className="text-gray-600">Total Projects Submitted</p>
                                </div>
                                <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                                    <CheckCircle className="w-8 h-8 text-green-600 mb-3" />
                                    <h3 className="text-2xl font-bold text-green-600">{stats.testedOrCompleted}</h3>
                                    <p className="text-gray-600">Projects Tested/Completed</p>
                                </div>
                                <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
                                    <Users className="w-8 h-8 text-red-800 mb-3" />
                                    <h3 className="text-2xl font-bold text-gray-800">{stats.totalTeams}</h3>
                                    <p className="text-gray-600">Total Teams Registered</p>
                                </div>
                            </div>
                            {/* --- (END RESTORED) --- */}


                            {/* Testing Status Section (Your new logic) */}
                            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                                <div className="px-6 py-4 border-b-2 border-gray-300">
                                    <h2 className="text-xl font-bold text-gray-800">Testing Status</h2>
                                </div>

                                <div className="p-4 border-b-2 border-gray-300">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search projects in active tab"
                                            value={testingStatusSearchQuery}
                                            onChange={(e) => setTestingStatusSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-gray-700"
                                        />
                                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>

                                <div className="flex border-b border-gray-300 flex-wrap">
                                    <StatusTab label="Testing Completed" value="COMPLETED" count={filteredProjectsCompleted.length} activeTab={activeStatusTab} setActiveTab={setActiveStatusTab} />
                                    <StatusTab label="Assigned" value="ASSIGNED" count={filteredProjectsAssigned.length} activeTab={activeStatusTab} setActiveTab={setActiveStatusTab} />
                                    <StatusTab label="Not Yet Assigned" value="UNASSIGNED" count={filteredProjectsUnassigned.length} activeTab={activeStatusTab} setActiveTab={setActiveStatusTab} />
                                    <StatusTab label="Reported Projects" value="BLOCKED_LINK" count={filteredProjectsReported.length} activeTab={activeStatusTab} setActiveTab={setActiveStatusTab} />
                                </div>

                                <div className="max-h-[400px] overflow-y-auto">
                                    {activeStatusTab === 'COMPLETED' && <ProjectList projects={filteredProjectsCompleted} />}
                                    {activeStatusTab === 'ASSIGNED' && <ProjectList projects={filteredProjectsAssigned} />}
                                    {activeStatusTab === 'UNASSIGNED' && <ProjectList projects={filteredProjectsUnassigned} />}
                                    {activeStatusTab === 'BLOCKED_LINK' && <ProjectList projects={filteredProjectsReported} />}
                                </div>
                            </div>

                            {/* --- (RESTORED) ALL TEAMS AND ALL PROJECTS --- */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* All Teams Section */}
                                <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b-2 border-gray-300">
                                        <h2 className="text-xl font-bold text-gray-800">All Teams ({filteredTeams.length})</h2>
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
                                            <p className="p-6 text-gray-500">{teamSearchQuery ? "No teams match your search." : "No teams registered yet."}</p>
                                        ) : (
                                            <ul className="divide-y divide-gray-300">
                                                {filteredTeams.map((team) => (
                                                    <li key={team.id} className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center">
                                                        <div>
                                                            <p className="font-semibold text-gray-800">{team.name}</p>
                                                            <p className="text-sm text-gray-600">Leader: {team.leader.name} {team.subgroup?.name ? `(${team.subgroup.name})` : ''}</p>
                                                        </div>
                                                        <Link href={`/faculty/team/${team.id}`} className="text-red-800 hover:text-red-900">
                                                            <ChevronRight className="w-5 h-5" />
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>

                                {/* All Projects Section */}
                                <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b-2 border-gray-300">
                                        <h2 className="text-xl font-bold text-gray-800">All Projects ({filteredAllProjects.length})</h2>
                                    </div>
                                    <div className="p-4 border-b-2 border-gray-300">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search projects by title or team"
                                                value={projectSearchQuery}
                                                onChange={(e) => setProjectSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-gray-700"
                                            />
                                            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        </div>
                                    </div>
                                    <div className="max-h-[600px] overflow-y-auto">
                                        {filteredAllProjects.length === 0 ? (
                                            <p className="p-6 text-gray-500">{projectSearchQuery ? "No projects match your search." : "No projects submitted yet."}</p>
                                        ) : (
                                            <ul className="divide-y divide-gray-300">
                                                {filteredAllProjects.map((project) => (
                                                    <li key={project.id} className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center">
                                                        <div>
                                                            <p className="font-semibold text-gray-800">{project.title}</p>
                                                            <p className="text-sm text-gray-600">Team: {project.team.name} ({project.status})</p>
                                                        </div>
                                                        <Link href={`/faculty/team/${project.team.id}`} className="text-red-800 hover:text-red-900">
                                                            <ChevronRight className="w-5 h-5" />
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {/* --- (END RESTORED) --- */}

                        </div>
                    )}

                    {activeTab === 'inbox' && (
                        <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                            <div className="px-6 py-4 border-b-2 border-gray-300">
                                <h2 className="text-xl font-bold text-gray-800">Inbox: Project Link Reports</h2>
                            </div>
                            <Inbox role="faculty" reports={inboxReports} onDataMutate={fetchData} />
                        </div>
                    )}
                </div>
            </div>
        </AuthCheck>
    );
}

// --- SUB COMPONENTS ---
function ProjectList({ projects }: { projects: Project[] }) {
    if (projects.length === 0) return <p className="p-6 text-gray-500 text-center">No projects in this category.</p>;
    return (
        <ul className="divide-y divide-gray-300">
            {projects.map(project => (
                <li key={project.id} className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center">
                    <div>
                        <p className="font-semibold text-gray-800">{project.title}</p>
                        <p className="text-sm text-gray-600">Team: {project.team.name}</p>
                    </div>
                    <Link href={`/faculty/team/${project.team.id}`} className="text-red-800 hover:text-red-900">
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
            className={`flex-1 p-4 font-semibold min-w-[150px] ${activeTab === value ? 'text-red-800 border-b-4 border-red-800' : 'text-gray-600 hover:bg-gray-50'}`}
        >
            {label} ({count})
        </button>
    );
}