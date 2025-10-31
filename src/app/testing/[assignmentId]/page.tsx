// src/app/testing/[assignmentId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
    FileText,
    ExternalLink,
    Github, // Kept in imports, but button is removed
    Plus,
    Upload,
    Lock,
    Clock,
    Check,
    X,
    Download,
    CheckCircle
} from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

// 1. IMPORT our Firebase functions
import {
    getTestcasesForAssignment,
    createTestcase, // <-- Will be called with new signature
    setTestcaseMetadataUrl,
    submitTestResult // <-- Will be called with new signature
} from '../../../../services/testcases'; // <-- Adjusted path
import {
    getProjectById, checkAndCompleteProject
} from '../../../../services/projects'; // <-- Adjusted path

import { markAssignmentComplete } from '../../../../services/assignments'; // <-- Adjusted path

// --- NEW IMPORTS for fetching assignment details ---
import { doc, getDoc } from "firebase/firestore";
import { db } from '../../../../services/firebaseConfig'; // <-- Adjusted path


const MIN_TEST_CASES_THRESHOLD = 5;

// 2. DEFINE TypeScript types
interface Project {
    id: string;
    title: string;
    description?: string;
    deployedLink?: string;
    githubLink?: string;
    techStack?: string;
    srsLink?: string;
    testCase1?: string;
    testCase2?: string;
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

interface TestCase {
    id: string;
    testcaseName: string;
    testDescription: string;
    designedBy: string;
    expectedResults: string;
    testStatus: 'pending' | 'pass' | 'fail';
    metadataImageUrl: string | null;
    testedBy: string | null;
    creationTime: any;
    // --- NEW: Added optional fields from backend ---
    testLogs?: string; 
    TID?: string;
}

interface NewTestCaseForm {
    title: string;
    description: string;
    designedBy: string;
    expectedResults: string;
    tid: string; // <-- CHANGED: Added TID
}

// --- 3. HELPER COMPONENTS ---

// --- Helper: Status Badge Component (Unchanged) ---
const StatusBadge = ({ status }: { status: TestCase['testStatus'] }) => {
    if (status === 'pass') {
        return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border-2 border-green-200">
                <Check className="w-4 h-4 mr-1.5" />
                Pass
            </span>
        );
    }
    if (status === 'fail') {
        return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border-2 border-red-200">
                <X className="w-4 h-4 mr-1.5" />
                Fail
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border-2 border-yellow-200">
            <Clock className="w-4 h-4 mr-1.5" />
            Pending
        </span>
    );
};

// --- Helper: Add Test Case Modal Component (CHANGED) ---
const AddTestModal = ({ assignmentId, onClose, studentName }: { assignmentId: string, onClose: () => void, studentName: string }) => {
    
    // --- CHANGED: Updated state to include TID and pre-fill designedBy ---
    const [formData, setFormData] = useState<NewTestCaseForm>({
        title: '',
        description: '',
        designedBy: studentName, // Pre-filled with current user
        expectedResults: '',
        tid: '', // Added new TID field
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // --- CHANGED: Updated function call to include TID ---
            const success = await createTestcase(
                assignmentId,
                formData.title,
                formData.description,
                formData.designedBy, // This is studentName
                formData.expectedResults,
                formData.tid // Pass the new TID
            );
            if (success) {
                setLoading(false);
                onClose(); 
            } else {
                throw new Error("Failed to create test case.");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred.");
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-gray-100 bg-opacity-90 flex items-center justify-center z-50 p-4"
            onClick={onClose} 
        >
            <div
                onClick={(e) => e.stopPropagation()} 
                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg border-4 border-red-800"
            >
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Test Case</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* --- Form fields CHANGED --- */}
                    {/* --- NEW: TID Field Added --- */}
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">TID (Test ID) *</label>
                        <input type="text" name="tid" value={formData.tid} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800" placeholder="e.g., T-001" />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Test Title *</label>
                        <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800" />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Test Description *</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} required rows={3} className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800" />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Expected Results *</label>
                        <textarea name="expectedResults" value={formData.expectedResults} onChange={handleChange} required rows={2} className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800" />
                    </div>
                    
                    {/* --- REMOVED: "Test Designed By" input field --- */}

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border-2 border-gray-300">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg disabled:opacity-50">
                            {loading ? 'Adding...' : 'Add Test Case'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Helper: Single Test Case Card Component (CHANGED) ---
const TestCaseCard = ({ tc, studentName, assignmentId }: { tc: TestCase, studentName: string, assignmentId: string }) => {
    const [uploading, setUploading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState('');
    
    // --- NEW: State for Test Logs ---
    const [testLogs, setTestLogs] = useState('');

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (File upload logic remains unchanged)
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError('');

        try {
            const apiResponse = await fetch('/api/s3-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    filetype: file.type,
                }),
            });

            if (!apiResponse.ok) throw new Error('Failed to get upload URL');
            
            const { presignedUploadUrl, publicFileUrl } = await apiResponse.json();

            const s3Response = await fetch(presignedUploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type,
                },
            });

            if (!s3Response.ok) throw new Error('S3 upload failed');

            const success = await setTestcaseMetadataUrl(tc.id, publicFileUrl);
            
            if (!success) throw new Error('Failed to save metadata URL to database');
            
        } catch (err: any) {
            setError(err.message || "Upload failed. Please try again.");
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    // --- CHANGED: handleSubmit now requires testLogs ---
    const handleSubmit = async (status: 'pass' | 'fail') => {
        if (!tc.metadataImageUrl) {
            alert("Please upload metadata before submitting a result.");
            return;
        }
        
        // --- NEW: Check for test logs ---
        if (!testLogs.trim()) {
            alert("Please provide test logs (a brief description) before submitting.");
            return;
        }

        setSubmitLoading(true);
        setError('');
        try {
            // --- CHANGED: Pass testLogs to the backend function ---
            const success = await submitTestResult(tc.id, status, studentName, testLogs);
            if (!success) throw new Error("Submission failed.");
        } catch (err: any)
        {
            setError(err.message || "Submission failed.");
        } finally {
             setSubmitLoading(false);
        }
    };

    return (
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-5 transition-all hover:shadow-md">
            <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-xl text-red-800">
                    {tc.TID && <span className="font-bold mr-2">[{tc.TID}]</span>} 
                    {tc.testcaseName}
                </h3>
                <StatusBadge status={tc.testStatus} />
            </div>

            <p className="text-gray-700 mb-2 text-sm"><span className="font-medium">Description:</span> {tc.testDescription}</p>
            <p className="text-gray-700 mb-4 text-sm"><span className="font-medium">Expected Results:</span> {tc.expectedResults}</p>

            <div className="text-sm text-gray-600 mb-6">
                <p><span className="font-medium">Designed By:</span> {tc.designedBy}</p>
                {tc.testStatus !== 'pending' && tc.testedBy && (
                    <p className="mt-1"><span className="font-medium">Tested By:</span> {tc.testedBy}</p>
                )}
                 {/* @ts-ignore */}
                 <p className="mt-1 text-xs italic">Created: {tc.creationTime?.toDate().toLocaleString()}</p>
            </div>

            {/* --- CHANGED: Layout for metadata, test logs, and buttons --- */}

            {/* 1. Metadata Upload */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    {tc.metadataImageUrl ? (
                        <a href={tc.metadataImageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-green-700 hover:underline font-medium">
                            <FileText className="w-4 h-4 mr-1.5" />
                            View Uploaded Metadata
                        </a>
                    ) : (
                        <label className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer ${uploading || tc.testStatus !== 'pending' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-300'}`}>
                            <Upload className="w-4 h-4 mr-1.5" />
                            {uploading ? 'Uploading...' : 'Upload Metadata *'}
                            <input type="file" onChange={handleFileUpload} disabled={uploading || tc.testStatus !== 'pending'} className="hidden" />
                        </label>
                    )}
                </div>
                {/* Old button location removed */}
            </div>

            {/* 2. Test Logs & Submit Buttons (Only if pending) */}
            {tc.testStatus === 'pending' ? (
                <div className="mt-4 space-y-3">
                    {/* Test Logs Textarea */}
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium text-sm">Test Logs (Required) *</label>
                        <textarea
                            name="testLogs"
                            value={testLogs}
                            onChange={(e) => setTestLogs(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-sm text-gray-600"
                            placeholder="Write Testing Logs"
                            disabled={submitLoading}
                        />
                    </div>
                    {/* Submit Buttons */}
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={() => handleSubmit('fail')}
                            disabled={!tc.metadataImageUrl || submitLoading || !testLogs.trim()}
                            className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title={!tc.metadataImageUrl ? "Upload metadata to enable" : !testLogs.trim() ? "Write test logs to enable" : ""}
                        >
                            <X className="w-4 h-4" /> Fail
                        </button>
                        <button
                            onClick={() => handleSubmit('pass')}
                            disabled={!tc.metadataImageUrl || submitLoading || !testLogs.trim()}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title={!tc.metadataImageUrl ? "Upload metadata to enable" : !testLogs.trim() ? "Write test logs to enable" : ""}
                        >
                            <Check className="w-4 h-4" /> Pass
                        </button>
                    </div>
                </div>
            ) : (
                // If already submitted, show submitted text and logs
                <div className="mt-4">
                    <span className="text-sm font-medium text-gray-500">Test Submitted</span>
                    {tc.testLogs && (
                        <div className="mt-2 p-3 bg-white border-2 border-gray-200 rounded-lg">
                            <p className="text-sm font-medium text-gray-800">Test Logs:</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{tc.testLogs}</p>
                        </div>
                    )}
                </div>
            )}
            
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
    );
};


// --- 4. MAIN PAGE COMPONENT (Unchanged below this line) ---
export default function ProjectTestingDetails() {
    const router = useRouter();
    const params = useParams();
    const assignmentId = params.assignmentId as string; 

    // --- State ---
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [projectDetails, setProjectDetails] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [markingComplete, setMarkingComplete] = useState(false);

    // Test Case related state
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [loadingTestCases, setLoadingTestCases] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [studentName, setStudentName] = useState('');

    // Fetch assignment/project details when ID is available
    useEffect(() => {
        if (assignmentId) {
            fetchAssignmentsAndDetails(assignmentId);
        }
        if (typeof window !== 'undefined') {
            setStudentName(localStorage.getItem('userName') || 'Anonymous Tester');
        }
    }, [assignmentId]);

    // Fetches test cases
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;

        if (assignmentId) {
            setLoadingTestCases(true);
            setTestCases([]);

            const unsub = getTestcasesForAssignment(
                assignmentId,
                (fetchedTestCases: TestCase[]) => {
                    setTestCases(fetchedTestCases);
                    setLoadingTestCases(false);
                }
            );
            unsubscribe = () => unsub();
        } else {
            setTestCases([]);
            setLoadingTestCases(false);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [assignmentId]);

    const handleMarkAsTested = async () => {
        if (!assignment) return;

        const submittedTestCases = testCases.filter(tc => tc.testStatus !== 'pending').length;
        if (submittedTestCases < MIN_TEST_CASES_THRESHOLD) {
            alert(`You must submit results for at least ${MIN_TEST_CASES_THRESHOLD} test cases. You have submitted ${submittedTestCases}.`);
            return;
        }

        if (!confirm("Are you sure you want to mark this assignment as complete? This action cannot be undone.")) {
            return;
        }

        setMarkingComplete(true);
        try {
            const result = await markAssignmentComplete(assignmentId, assignment.project.id);
            if (result.success) {
                alert("Assignment marked as complete!");
                await checkAndCompleteProject(assignment.project.id);
                fetchAssignmentsAndDetails(assignment.id); 
            } else {
                throw new Error(result.error || "Failed to mark complete.");
            }
        } catch (error: any) {
            console.error("Error marking assignment complete:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setMarkingComplete(false);
        }
    };

    // --- Data Fetching Function (Unchanged logic) ---
    const fetchAssignmentsAndDetails = async (id: string) => {
        setLoading(true);
        setAssignment(null);
        setProjectDetails(null);
        try {
            // 1. Fetch the Assignment document itself
            const assignmentRef = doc(db, "assignments", id);
            const assignmentSnap = await getDoc(assignmentRef);

            if (!assignmentSnap.exists()) {
                throw new Error("Assignment not found");
            }
            const assignData = assignmentSnap.data() as {
                projectId: any; 
                jiskaProjectTeamId: any; 
                status: string;
            };

            // 2. Fetch the referenced Project and Original Team
            // @ts-ignore
            const projectSnap = await getDoc(assignData.projectId);
            // @ts-ignore
            const originalTeamSnap = await getDoc(assignData.jiskaProjectTeamId);

            if (!projectSnap.exists() || !originalTeamSnap.exists()) {
                throw new Error("Project or Team data missing");
            }

            const projectData = projectSnap.data() as Omit<Project, 'id'>;
            const originalTeamData = originalTeamSnap.data() as { teamName: string };

            // 3. Set the state
            setAssignment({
                id: assignmentSnap.id,
                status: assignData.status || "ASSIGNED",
                project: {
                    id: projectSnap.id,
                    title: projectData.title || "Untitled Project",
                },
                originalTeam: {
                    id: originalTeamSnap.id,
                    teamName: originalTeamData.teamName || "Unknown Team",
                },
            });

            // 4. Set the full project details state
            // This will now automatically include testCase1 and testCase2
            setProjectDetails({
                id: projectSnap.id,
                ...projectData,
            } as Project);

        } catch (error) {
            console.error('Error fetching data:', error);
            setAssignment(null);
            setProjectDetails(null);
        } finally {
            setLoading(false);
        }
    };

    
    // Loading component
    if (loading) {
        return (
            <AuthCheck requiredRole="student">
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading Assignment Details...</p>
                    </div>
                </div>
            </AuthCheck>
        );
    }

   // --- RENDER THE PAGE (Unchanged) ---
    return (
        <AuthCheck requiredRole="student">
            <div className="min-h-screen bg-gray-100">
                <Header title="Project Testing" userRole={studentName} />

                <div className="max-w-6xl mx-auto px-6 py-8">
                    {/* Navigation Tabs */}
                    <div className="flex gap-4 mb-6">
                        <Link
                            href="/dashboard"
                            className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/testing"
                            className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium"
                        >
                            Project Testing
                        </Link>
                    </div>
                    
                    {!assignment ? (
                        // No active assignment found
                        <div className="bg-white border-2 border-gray-300 rounded-xl p-12 text-center">
                            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-600 mb-2">
                                Assignment Not Found
                            </h3>
                            <p className="text-gray-500">
                                This testing assignment could not be loaded.
                            </p>
                        </div>
                    ) : !projectDetails ? (
                        // Assignment found, but waiting for project details
                        <div className="bg-white border-2 border-gray-300 rounded-xl p-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading Project Details...</p>
                        </div>
                    ) : (
                        // Both assignment AND projectDetails are loaded.
                        <div className="bg-white border-2 border-gray-300 rounded-xl p-8 shadow-sm mb-6">
                            {/* Project Info */}
                            <div className="flex items-start gap-6 mb-10 border-b-2 border-gray-300 pb-10">
                                <FileText className="w-16 h-16 text-red-800 flex-shrink-0 mt-2" />
                                <div className="flex-1">
                                    <h2 className="text-4xl font-bold text-gray-800 mb-4">
                                        {projectDetails.title}
                                    </h2>
                                    
                                    <div className="flex flex-wrap gap-4 mb-6">
                                        {projectDetails.deployedLink && (
                                            <a
                                                href={projectDetails.deployedLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 inline-flex items-center gap-2"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                View Live Project
                                            </a>
                                        )}
                                        {projectDetails.srsLink && (
                                            <a
                                                href={projectDetails.srsLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 inline-flex items-center gap-2"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download SRS
                                            </a>
                                        )}
                                    </div>

                                    {/* Description */}
                                    {projectDetails.description && (
                                        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mb-3">
                                            <h3 className="font-semibold text-gray-800 mb-2">
                                                Project Description
                                            </h3>
                                            <p className="text-gray-700 text-sm">
                                                {projectDetails.description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Required Test Cases */}
                                    {(projectDetails.testCase1 || projectDetails.testCase2) && (
                                        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mb-3">
                                            <h3 className="font-semibold text-gray-800 mb-2">
                                                Required Test Cases
                                            </h3>
                                            <div className="space-y-2">
                                                {projectDetails.testCase1 && (
                                                    <p className="text-gray-700 text-sm">
                                                        <strong>Test Case 1:</strong> {projectDetails.testCase1}
                                                    </p>
                                                )}
                                                {projectDetails.testCase2 && (
                                                    <p className="text-gray-700 text-sm">
                                                        <strong>Test Case 2:</strong> {projectDetails.testCase2}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}


                                    {/* Tech Stack */}
                                    {projectDetails.techStack && (
                                        <div>
                                            <span className="text-sm text-gray-600">
                                                <strong>Tech Stack:</strong> {projectDetails.techStack}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Test Cases Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-gray-800">Your Test Cases</h3>
                                    <button
                                        onClick={() => setShowModal(true)}
                                        className="px-5 py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-lg font-medium inline-flex items-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Add Test Case
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    {loadingTestCases ? (
                                        <p className="text-gray-500 text-center py-4">Loading test cases...</p>
                                    ) : testCases.length === 0 ? (
                                        <p className="text-gray-500 text-center py-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg">No test cases added yet. Click 'Add Test Case' to start.</p>
                                    ) : (
                                        testCases.map((tc) => (
                                            <TestCaseCard key={tc.id} tc={tc} studentName={studentName} assignmentId={assignmentId} />
                                        ))
                                    )}
                                </div>
                                
                                {/* "Mark as Tested" Button Section */}
                                {assignment.status !== 'COMPLETED' && ( 
                                    <div className="border-t-2 border-gray-300 pt-6 mt-6">
                                        <button
                                            onClick={handleMarkAsTested}
                                            disabled={markingComplete || testCases.filter(tc => tc.testStatus !== 'pending').length < MIN_TEST_CASES_THRESHOLD}
                                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-green-300"
                                            title={testCases.filter(tc => tc.testStatus !== 'pending').length < MIN_TEST_CASES_THRESHOLD ? `Submit at least ${MIN_TEST_CASES_THRESHOLD} test case results first` : ""}
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            {markingComplete ? 'Submitting...' : 'Mark Testing as Complete'}
                                        </button>
                                         <p className="text-xs text-gray-500 mt-2 text-center">
                                            Requires {MIN_TEST_CASES_THRESHOLD} submitted test cases ({testCases.filter(tc => tc.testStatus !== 'pending').length} submitted). This action is final.
                                         </p>
                                    </div>
                                )}
                                {assignment.status === 'COMPLETED' && (
                                     <p className="text-center text-green-600 font-medium mt-6 border-t-2 border-gray-300 pt-6">
                                         <CheckCircle className="w-5 h-5 inline mr-1" /> Testing for this project is complete.
                                     </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Render */}
            {showModal && assignmentId && (
                <AddTestModal
                    assignmentId={assignmentId}
                    onClose={() => setShowModal(false)}
                    studentName={studentName}
                />
            )}
        </AuthCheck>
    );
}