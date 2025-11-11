// src/app/faculty/team/[teamId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // <-- useRouter added
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';

// Import necessary service functions
import { getTeamDetails, getTeamMembersDetails } from '../../../../../services/teams';
import { getProjectsByTeam } from '../../../../../services/projects';
import { getTestcasesForAssignmentOnce } from '../../../../../services/testcases'; 


import { 
    Users, 
    FileText, 
    Mail, 
    ArrowLeft, 
    ExternalLink, 
    Github, 
    Download, 
    Loader2,
    ClipboardList,
    Check,
    X,
    Clock,
    ImageIcon,
    ChevronDown,
    ChevronUp,
    File,
    Star
} from 'lucide-react';

// --- DEFINE TYPES ---
interface StudentMember {
    id: string;
    name: string;
    email: string;
}

interface TeamDetails {
    id: string;
    teamName: string;
    teamLeader: any; // Firestore DocumentReference
    teamMembers: any[]; // Array of Firestore DocumentReferences
}

interface TestCase {
    id: string;
    testcaseName: string;
    testDescription: string;
    TID: string;
    expectedResults: string;
    testStatus: 'pass' | 'fail' | 'pending';
    designedBy: string;
    testedBy?: string;
    testLogs?: string;
    metadataImageUrl?: string;
    creationTime: string | null;
    resultSubmissionTime: string | null;
}

interface AssignmentDetail {
    id: string;
    status: string;
    assignedTo: {
        id: string | null;
        name: string;
    };
    testCases?: TestCase[]; 
}

interface Project {
    id: string;
    title: string;
    status: string;
    description?: string;
    deployedLink?: string;
    githubLink?: string;
    submissionTime?: any; // Firestore Timestamp
    testCase1?: string;
    testCase2?: string;
    testAssignments?: AssignmentDetail[];
}

export default function TeamDetailPage() {
    const params = useParams();
    const router = useRouter(); // <-- Router instantiated
    const teamId = params.teamId as string; 

    const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
    const [teamMembers, setTeamMembers] = useState<StudentMember[]>([]);
    const [project, setProject] = useState<Project | null>(null); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userName, setUserName] = useState('');
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        const name = localStorage.getItem('userName') || 'Faculty';
        setUserName(name);

        if (teamId) {
            fetchTeamData(teamId);
        } else {
            setError("Team ID not found in URL.");
            setLoading(false);
        }
    }, [teamId]); 

    const fetchTeamData = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const teamData = await getTeamDetails(id) as TeamDetails | null; // <-- Fix from previous step
            if (!teamData) throw new Error("Team not found.");

            const teamInfo = teamData as any;
            setTeamDetails(teamInfo);

            const [membersData, projectsData] = await Promise.all([
                getTeamMembersDetails(teamInfo.teamMembers),
                getProjectsByTeam(id) 
            ]);

            setTeamMembers((membersData || []) as StudentMember[]);

            if (projectsData && projectsData.length > 0) {
                let proj = projectsData[0] as Project;

                if (proj.testAssignments && proj.testAssignments.length > 0) {
                    const assignmentsWithTestCases = await Promise.all(
                        proj.testAssignments.map(async (assignment) => {
                            const testCases = await getTestcasesForAssignmentOnce(assignment.id);
                            return { ...assignment, testCases: testCases as TestCase[] };
                        })
                    );
                    proj.testAssignments = assignmentsWithTestCases;
                }
                setProject(proj); 
            } else {
                setProject(null); 
            }

        } catch (err: any) {
            console.error("Error fetching team data:", err);
            setError(err.message || "Failed to load team details.");
            setTeamDetails(null);
            setTeamMembers([]);
            setProject(null);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp?.toDate) {
            if (typeof timestamp === 'string') {
                try {
                    const date = new Date(timestamp);
                    if (isNaN(date.getTime())) return 'N/A'; 
                    return date.toLocaleString();
                } catch (e) { return 'N/A'; }
            }
            return 'N/A';
        }
        return timestamp.toDate().toLocaleString(); 
    }

    if (loading) {
        return (
             <AuthCheck requiredRole="faculty">
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="text-center"> <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div> <p className="mt-4 text-gray-600">Loading Team Details...</p> </div>
                </div>
            </AuthCheck>
        );
    }

     if (error) {
        return (
            <AuthCheck requiredRole="faculty">
                 <div className="min-h-screen bg-gray-100">
                     <Header title="Error" userRole={userName} />
                     <div className="max-w-7xl mx-auto px-6 py-8 text-center">
                         <p className="text-red-600 mb-4">{error}</p>
                         <button onClick={() => router.back()} className="text-red-800 hover:underline">
                             &larr; Go Back
                         </button>
                     </div>
                 </div>
            </AuthCheck>
        );
    }

    if (!teamDetails) {
         return ( 
            <AuthCheck requiredRole="faculty">
                 <div className="min-h-screen bg-gray-100">
                     <Header title="Team Not Found" userRole={userName} />
                      <div className="max-w-7xl mx-auto px-6 py-8 text-center">
                         <p className="text-gray-600 mb-4">The requested team could not be found.</p>
                         <button onClick={() => router.back()} className="text-red-800 hover:underline">
                              &larr; Go Back
                         </button>
                     </div>
                 </div>
            </AuthCheck>
        );
    }

    const handleDownloadReport = async (projectTitle: string) => {
        // --- MODIFICATION START ---
        // We use the project's ID, not a specific assignment ID.
        const projectIdToDownload = project?.id;

        if (!projectIdToDownload) {
            alert("No project ID found. Cannot download report.");
            return;
        }
        // --- MODIFICATION END ---

        setDownloading(true);
        try {
            // --- MODIFICATION START ---
            // Point to the project-wide report API route.
            // We add ?censored=false to ensure faculty get the full uncensored report.
            const response = await fetch(`/api/reports/project/${projectIdToDownload}?censored=false`);
            // --- MODIFICATION END ---
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to download PDF");
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const disposition = response.headers.get('content-disposition');
            let filename = `testing_report_${projectTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`; 
            if (disposition && disposition.includes('attachment')) {
                const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch?.[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error: any) {
            console.error(error);
            alert(`Error downloading report: ${error.message}`);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <AuthCheck requiredRole="faculty">
            <div className="min-h-screen bg-gray-100">
                <Header title={`Team: ${teamDetails.teamName}`} userRole={userName} />

                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* --- Back Button UPDATED --- */}
                    <div className="mb-6">
                        <button
                            onClick={() => router.back()} // <-- CHANGED
                            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* --- Column 1: Team Members --- */}
                        <div className="lg:col-span-1 bg-white border-2 border-gray-300 rounded-xl shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Users className="w-6 h-6 text-red-800" />
                                Submitting Team Members
                            </h2>
                            {teamMembers.length === 0 ? (
                                <p className="text-gray-500 italic">No member details found.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {teamMembers.map(member => (
                                        <li key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                            <Users className="w-5 h-5 text-gray-500 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 truncate">{member.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                     <Mail className="w-3 h-3 text-gray-400"/>
                                                     <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                                </div>
                                            </div>
                                             {member.id === teamDetails.teamLeader?.id && (
                                                <span className="flex-shrink-0 text-xs font-semibold text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">Leader</span>
                                             )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* --- Column 2: Submitted Project --- */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm p-6">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <FileText className="w-6 h-6 text-red-800" />
                                    Submitted Project
                                </h2>
                                {!project ? (
                                    <div className="text-center py-8">
                                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500 italic">This team has not submitted a project yet.</p>
                                    </div>
                                ) : (
                                    <div>
                                        <h3 className="text-2xl font-semibold text-gray-900 mb-1">{project.title}</h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Submitted on: {formatDate(project.submissionTime)}
                                        </p>

                                        <div className="mb-4">
                                      <span
                                        className={`px-3 py-1 rounded-full text-sm font-medium
                                          ${
                                            project.status === 'COMPLETED'
                                              ? 'bg-green-100 text-green-700'
                                              : project.status === 'ASSIGNED'
                                              ? 'bg-blue-100 text-blue-700'
                                              : project.status === 'BLOCKED_LINK'
                                              ? 'bg-red-100 text-red-700'
                                              : 'bg-yellow-100 text-yellow-700'
                                          }`}
                                      >
                                        Project Status: {project.status}
                                      </span>
                                      </div>


                                        {project.description && (
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                                <h4 className="font-semibold text-gray-800 mb-1">Description</h4>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.description}</p>
                                            </div>
                                        )}

                                        {(project.testCase1 || project.testCase2) && (
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                                <h4 className="font-semibold text-gray-800 mb-3">Developer Test Cases</h4>
                                                <div className="space-y-2">
                                                    {project.testCase1 && (
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-700">Test Case 1:</p>
                                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.testCase1}</p>
                                                        </div>
                                                    )}
                                                    {project.testCase2 && (
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-700">Test Case 2:</p>
                                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.testCase2}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-3">
                                            {project.deployedLink && (
                                                <a href={project.deployedLink} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 inline-flex items-center gap-2">
                                                    <ExternalLink className="w-4 h-4" /> View Live 
                                                </a>
                                            )}
                                            {project.githubLink && (
                                                <a href={project.githubLink} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 inline-flex items-center gap-2">
                                                    <Github className="w-4 h-4" /> GitHub 
                                                </a>
                                            )}
                                            <Link href={`/faculty/assignments`} className="px-4 py-2 bg-red-100 border-2 border-red-300 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 inline-flex items-center gap-2">
                                                    Manage Assignment &rarr;
                                            </Link>
                                            <button
                                                onClick={() => handleDownloadReport(project.title)}
                                                disabled={downloading}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Download full project report (in-progress or complete)"
                                            >
                                                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                {downloading ? "Generating..." : "Download Report"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* --- TESTING STATUS SECTION --- */}
                            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                                <h2 className="text-xl font-bold text-gray-800 mb-0 p-6 border-b-2 border-gray-300 flex items-center gap-2">
                                    <ClipboardList className="w-6 h-6 text-red-800" />
                                    Testing Details
                                </h2>
                                {(!project?.testAssignments || project.testAssignments.length === 0) ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 italic">This project has not been assigned for testing yet.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y-2 divide-gray-300">
                                        {project.testAssignments.map((assignment) => (
                                            <AssignmentDetailsCard 
                                                key={assignment.id} 
                                                assignment={assignment} 
                                                formatDate={formatDate}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthCheck>
    );
}

// --- SUB-COMPONENT: AssignmentDetailsCard ---
function AssignmentDetailsCard({ assignment, formatDate }: { assignment: AssignmentDetail, formatDate: (ts: any) => string }) {
    const [isOpen, setIsOpen] = useState(false);
    const testCases = assignment.testCases || [];
    
    const [members, setMembers] = useState<StudentMember[] | null>(null);
    const [leaderId, setLeaderId] = useState<string | null>(null);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);

    const stats = testCases.reduce((acc, tc) => {
        if (tc.testStatus === 'pass') acc.pass++;
        else if (tc.testStatus === 'fail') acc.fail++;
        else acc.pending++;
        return acc;
    }, { pass: 0, fail: 0, pending: 0 });


    const loadMemberData = async () => {
        if (!assignment.assignedTo.id || members) return; 

        setIsLoadingMembers(true);
        try {
            const teamDetailsData = await getTeamDetails(assignment.assignedTo.id) as TeamDetails | null;
            if (teamDetailsData) {
                const teamMembersData = await getTeamMembersDetails(teamDetailsData.teamMembers);
                setMembers(teamMembersData as StudentMember[]);
                setLeaderId(teamDetailsData.teamLeader.id); 
            }
        } catch (error) {
            console.error("Failed to load team members:", error);
        } finally {
            setIsLoadingMembers(false);
        }
    };

    const handleToggleOpen = () => {
        const nextOpenState = !isOpen;
        setIsOpen(nextOpenState);
        if (nextOpenState && !members) {
            loadMemberData();
        }
    };

    return (
        <div className="p-6">
            {/* --- Header --- */}
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-sm text-gray-600">Assigned to:</p>
                    <h3 className="text-lg font-semibold text-gray-900">{assignment.assignedTo.name}</h3>
                </div>
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        assignment.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        (assignment.status === 'ASSIGNED' || assignment.status === 'TESTING') ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                    }`}>
                        {assignment.status}
                    </span>
                    <button
                        onClick={handleToggleOpen}
                        className="text-red-800 hover:text-red-900"
                        title={isOpen ? "Collapse" : "Expand"}
                    >
                        {isOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* --- Collapsible Content --- */}
            {isOpen && (
                <div className="mt-6 space-y-6">
                    
                    {/* --- Testing Team Members Section --- */}
                    <div>
                        <h4 className="text-md font-semibold text-gray-800 mb-3">
                            Testing Team Members
                        </h4>
                        {isLoadingMembers && (
                            <div className="flex justify-center items-center h-24">
                                <Loader2 className="w-6 h-6 text-red-800 animate-spin" />
                            </div>
                        )}
                        {!isLoadingMembers && members && (
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {members.map(member => (
                                    <li key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                        <Users className="w-5 h-5 text-gray-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">{member.name}</p>
                                        </div>
                                        {member.id === leaderId && (
                                            <span className="flex-shrink-0 text-xs font-semibold text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">Leader</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* --- Test Case Summary --- */}
                    <div>
                        <h4 className="text-md font-semibold text-gray-800 mb-3">
                            Test Case Summary ({testCases.length} total)
                        </h4>
                        <div className="grid grid-cols-3 gap-3 text-center mb-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                                <Check className="w-5 h-5 text-green-600 mx-auto" />
                                <p className="text-lg font-bold text-green-700">{stats.pass}</p>
                                <p className="text-xs text-green-600">Pass</p>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                                <X className="w-5 h-5 text-red-600 mx-auto" />
                                <p className="text-lg font-bold text-red-700">{stats.fail}</p>
                                <p className="text-xs text-red-600">Fail</p>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                                <Clock className="w-5 h-5 text-yellow-600 mx-auto" />
                                <p className="text-lg font-bold text-yellow-700">{stats.pending}</p>
                                <p className="text-xs text-yellow-600">Pending</p>
                            </div>
                        </div>
                    </div>

                    {/* --- Test Case List --- */}
                    <div>
                        <h4 className="text-md font-semibold text-gray-800 mb-3">Submitted Test Cases</h4>
                        {testCases.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">No test cases have been submitted for this assignment yet.</p>
                        ) : (
                            <ul className="space-y-4">
                                {testCases.map((tc) => (
                                    <TestCaseDetail key={tc.id} testCase={tc} formatDate={formatDate} />
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- SUB-COMPONENT: TestCaseDetail ---
function TestCaseDetail({ testCase, formatDate }: { testCase: TestCase, formatDate: (ts: any) => string }) {
    const { 
        testcaseName, 
        TID, 
        testDescription, 
        expectedResults, 
        testStatus, 
        testedBy, 
        testLogs, 
        metadataImageUrl,
        resultSubmissionTime
    } = testCase;

    return (
        <li className="bg-gray-50 border-2 border-gray-300 rounded-lg overflow-hidden">
            <div className={`p-4 border-l-8 ${
                testStatus === 'pass' ? 'border-green-500' :
                testStatus === 'fail' ? 'border-red-500' :
                'border-yellow-400'
            }`}>
                <div className="flex justify-between items-center mb-2">
                    <h5 className="font-bold text-gray-900">
                        {TID}: {testcaseName}
                    </h5>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        testStatus === 'pass' ? 'bg-green-100 text-green-700' :
                        testStatus === 'fail' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                    }`}>
                        {testStatus}
                    </span>
                </div>

                <p className="text-sm text-gray-700 mb-2"><strong>Description:</strong> {testDescription}</p>
                <p className="text-sm text-gray-700"><strong>Expected Results:</strong> {expectedResults}</p>

                <hr className="my-3 border-gray-300" />
                
                {testStatus === 'pending' ? (
                    <p className="text-sm text-yellow-700 italic">This test has not been executed yet.</p>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-800">
                            <strong>Tested By:</strong> {testedBy || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-800">
                            <strong>Submission Time:</strong> {formatDate(resultSubmissionTime)}
                        </p>
                        {testLogs && (
                            <div className="bg-gray-800 text-white rounded-md p-3">
                                <p className="text-sm font-medium text-gray-300 mb-1">Test Logs / Comments:</p>
                                <pre className="text-xs font-mono whitespace-pre-wrap">{testLogs}</pre>
                            </div>
                        )}
                        {metadataImageUrl && (
                            <a 
                                href={metadataImageUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-red-800 hover:underline"
                            >
                                <ImageIcon className="w-4 h-4" /> View Attached Metadata
                            </a>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
}