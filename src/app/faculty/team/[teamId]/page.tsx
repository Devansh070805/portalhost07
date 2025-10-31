// src/app/faculty/team/[teamId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Use useParams to get ID from URL
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';

// Import necessary service functions
import { getTeamDetails, getTeamMembersDetails } from '../../../../../services/teams'; // Adjust path
import { getProjectsByTeam } from '../../../../../services/projects'; // Adjust path
import { Users, FileText, Mail, ArrowLeft, ExternalLink, Github, Download, Loader2 } from 'lucide-react'; // Added Download, Loader2

// Define types
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

interface Project {
    id: string;
    title: string;
    status: string;
    description?: string;
    deployedLink?: string;
    githubLink?: string;
    submissionTime?: any; // Firestore Timestamp
    testAssignment?: { // <<< ADD THIS OPTIONAL PROPERTY
        id: string;
        // Add other assignment fields if needed
    };
}

export default function TeamDetailPage() {
    const params = useParams();
    const router = useRouter();
    const teamId = params.teamId as string; // Get teamId from URL

    const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
    const [teamMembers, setTeamMembers] = useState<StudentMember[]>([]);
    const [project, setProject] = useState<Project | null>(null); // Assuming one project per team
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
    }, [teamId]); // Re-run if teamId changes

    const fetchTeamData = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const teamData = await getTeamDetails(id);
            if (!teamData) throw new Error("Team not found.");

            const teamInfo = teamData as TeamDetails; // Cast the fetched data
            setTeamDetails(teamInfo);

            // Fetch members and project in parallel
            const [membersData, projectsData] = await Promise.all([
                getTeamMembersDetails(teamInfo.teamMembers),
                getProjectsByTeam(id) // Fetch projects submitted BY this team
            ]);

            setTeamMembers((membersData || []) as StudentMember[]);

            // Assuming a team submits only one project for this system
            if (projectsData && projectsData.length > 0) {
                setProject(projectsData[0] as Project); // Take the first project
            } else {
                setProject(null); // No project submitted
            }

        } catch (err: any) {
            console.error("Error fetching team data:", err);
            setError(err.message || "Failed to load team details.");
            setTeamDetails(null); // Clear data on error
            setTeamMembers([]);
            setProject(null);
        } finally {
            setLoading(false);
        }
    };

    // Helper to format date
    const formatDate = (timestamp: any) => {
        if (!timestamp?.toDate) return 'N/A';
        return timestamp.toDate().toLocaleDateString();
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
                         <Link href="/faculty/subgroups" className="text-red-800 hover:underline">
                             &larr; Back to Subgroups
                         </Link>
                     </div>
                 </div>
            </AuthCheck>
        );
    }

    if (!teamDetails) {
         return ( // Handle case where team wasn't found but no specific error message
            <AuthCheck requiredRole="faculty">
                 <div className="min-h-screen bg-gray-100">
                     <Header title="Team Not Found" userRole={userName} />
                      <div className="max-w-7xl mx-auto px-6 py-8 text-center">
                         <p className="text-gray-600 mb-4">The requested team could not be found.</p>
                         <Link href="/faculty/subgroups" className="text-red-800 hover:underline">
                              &larr; Back to Subgroups
                         </Link>
                     </div>
                 </div>
            </AuthCheck>
        );
    }

    const handleDownloadReport = async (assignmentId: string | undefined, projectTitle: string) => {
        // Find the actual assignment ID from the project data if your structure nests it
        // For now, assuming the faculty dashboard fetch adds 'testAssignment.id' to the project object
        // If not, you might need to fetch assignments separately here or pass it differently.
        // Let's assume project.testAssignment.id exists for this example.

        // @ts-ignore - Assuming project has testAssignment populated by a fetch
        const actualAssignmentId = project?.testAssignment?.id;

        if (!actualAssignmentId) {
            alert("Assignment ID is missing for this project. Cannot download report.");
            // Or fetch it if needed:
            // const assignment = await findAssignmentForProject(project.id);
            // if (!assignment) { alert(...); return; }
            // actualAssignmentId = assignment.id;
            return;
        }

        setDownloading(true);
        try {
            // Call the API route
            const response = await fetch(`/api/reports/testing/${actualAssignmentId}`); // Use the correct ID

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
            let filename = `testing_report_${projectTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`; // Replace spaces
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
                    {/* Back Button */}
                    <div className="mb-6">
                        <Link
                            href="/faculty/subgroups" // Link back to the subgroups page
                            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back to Subgroups
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Column 1: Team Members */}
                        <div className="lg:col-span-1 bg-white border-2 border-gray-300 rounded-xl shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Users className="w-6 h-6 text-red-800" />
                                Team Members ({teamMembers.length})
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
                                             {/* Highlight Leader - Compare member ID with leader reference ID */}
                                             {member.id === teamDetails.teamLeader?.id && (
                                                <span className="text-xs font-semibold text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full flex-shrink-0">Leader</span>
                                             )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Column 2: Submitted Project */}
                        <div className="lg:col-span-2 bg-white border-2 border-gray-300 rounded-xl shadow-sm p-6">
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
                                    <p className="text-sm text-gray-500 mb-4">Submitted on: {formatDate(project.submissionTime)}</p>

                                    <div className="mb-4">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            project.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                            project.status === 'ASSIGNED' || project.status === 'TESTING' ? 'bg-blue-100 text-blue-700' :
                                            'bg-yellow-100 text-yellow-700' // Default to pending style
                                            }`}>
                                            Status: {project.status}
                                        </span>
                                    </div>

                                    {project.description && (
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                            <h4 className="font-semibold text-gray-800 mb-1">Description</h4>
                                            <p className="text-sm text-gray-700">{project.description}</p>
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
                                          {/* You might want a link to manage this project's assignment */}
                                          <Link href={`/faculty/assignments`} className="px-4 py-2 bg-red-100 border-2 border-red-300 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 inline-flex items-center gap-2">
                                                Manage Assignment &rarr;
                                          </Link>
                                          {/* --- NEW Download Button --- */}
                                        <button
                                            onClick={() => handleDownloadReport(project.testAssignment?.id, project.title)}
                                            disabled={downloading || project.status !== 'COMPLETED'}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-green-300"
                                            title={project.status !== 'COMPLETED' ? "Report available only when testing is completed" : "Download test report PDF"}
                                        >
                                            {downloading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                            {downloading ? "Generating..." : "Download Report"}
                                        </button>
                                        {/* --- END Download Button --- */}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthCheck>
    );
}