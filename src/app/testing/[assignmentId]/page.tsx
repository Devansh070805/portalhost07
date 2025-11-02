// src/app/testing/[assignmentId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
    FileText,
    ExternalLink,
    Plus,
    Upload,
    Clock,
    Check,
    X,
    Download,
    CheckCircle,
    Save,
    AlertTriangle,
    Trash2,
    XCircle,
    Send
} from 'lucide-react';
import Header from '@/components/Header'; // <-- HEADER IS HERE
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

// 1. IMPORT our Firebase functions
import {
    getTestcasesForAssignment,
    createTestcase,
    setTestcaseMetadataUrl,
    submitTestResult,
    deleteTestcase
} from '../../../../services/testcases';
import {
    getProjectById, checkAndCompleteProject
} from '../../../../services/projects';

import {
    markAssignmentComplete,
    saveAssignmentEvaluation,
    reportProjectLink,
} from '../../../../services/assignments';

// --- NEW IMPORTS for fetching assignment details ---
import { doc, getDoc, onSnapshot, query, collection, where } from "firebase/firestore";
import { db } from '../../../../services/firebaseConfig';


const MIN_TEST_CASES_THRESHOLD = 5;

// 2. DEFINE TypeScript types (Unchanged)
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

interface EvaluationData {
    q1: 'Yes' | 'No' | 'Not Accessible' | '';
    q2: 'Yes' | 'No' | '';
    q3: 'Yes' | 'No' | '';
    q4: 'Yes' | 'No' | '';
    q5: 'Yes' | 'No' | '';
    comment: string;
}

interface DebuggingReport {
    issueSummary: string;
    stepsToReproduce: string;
    expectedBehavior: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    suggestedFix?: string;
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
    status: 'ASSIGNED' | 'COMPLETED' | 'LINK_REPORTED';
    evaluation?: EvaluationData;
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
    TID?: string;
    actualResult?: string;
    debuggingReport?: DebuggingReport;
    severity?: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface NewTestCaseForm {
    title: string;
    description: string;
    designedBy: string;
    expectedResults: string;
}

// --- 3. HELPER COMPONENTS ---

// --- Helper: Status Badge Component (Unchanged) ---
const StatusBadge = ({ status }: { status: TestCase['testStatus'] }) => {
    // (This component is unchanged)
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
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
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

const AddTestModal = ({ assignmentId, teamId, onClose, studentName }: { assignmentId: string, teamId: string, onClose: () => void, studentName: string }) => {
    // (Logic is unchanged, styling is)
    const [formData, setFormData] = useState<NewTestCaseForm>({
        title: '',
        description: '',
        designedBy: studentName,
        expectedResults: '',
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
            const generatedTID = `TC-${teamId.substring(0, 6)}-${Date.now().toString().slice(-5)}`;

            // @ts-ignore
            const success = await createTestcase(
                assignmentId,
                formData.title,
                formData.description,
                formData.designedBy,
                formData.expectedResults,
                generatedTID
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
            className="fixed inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg border-4 border-red-800"
            >
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Test Case</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Test Title *</label>
                        <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700" />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Test Description / Objective *</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} required rows={3} className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700" />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Expected Results *</label>
                        <textarea name="expectedResults" value={formData.expectedResults} onChange={handleChange} required rows={2} className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700" />
                    </div>
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

// --- Helper: Fail Report Modal Component (Styling updated for dark mode) ---
const FailReportModal = ({ tc, studentName, actualResult, onClose, onSubmitted }: {
    tc: TestCase,
    studentName: string,
    actualResult: string,
    onClose: () => void,
    onSubmitted: () => void
}) => {
    // (Logic is unchanged, styling is)
    const [reportData, setReportData] = useState<Omit<DebuggingReport, 'expectedBehavior'>>({
        issueSummary: '',
        stepsToReproduce: '',
        severity: 'Medium',
        suggestedFix: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setReportData({ ...reportData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!reportData.issueSummary || !reportData.stepsToReproduce || !reportData.severity) {
            setError("Please fill in all required fields.");
            setLoading(false);
            return;
        }

        const finalReport: DebuggingReport = {
            ...reportData,
            expectedBehavior: tc.expectedResults,
        };

        try {
            const success = await submitTestResult(
                tc.id,
                'fail',
                studentName,
                actualResult,
                finalReport as any
            );

            if (success) {
                setLoading(false);
                onSubmitted();
                onClose();
            } else {
                throw new Error("Failed to submit fail report.");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred.");
            setLoading(false);
        }
    };
    
    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl border-4 border-red-800"
            >
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-700" />
                    <h2 className="text-2xl font-bold text-gray-800">Create Debugging Report</h2>
                </div>
                <p className="text-sm text-gray-600 mb-1">Test Case: <span className="font-medium">{tc.TID} - {tc.testcaseName}</span></p>
                <p className="text-sm text-gray-600 mb-4">You marked this test as <span className="font-bold text-red-700">FAIL</span>. Please provide details.</p>
                
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Issue Summary *</label>
                        <input type="text" name="issueSummary" value={reportData.issueSummary} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700" placeholder="e.g., 'Checkout form accepts empty phone number.'" />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Steps to Reproduce *</label>
                        <textarea name="stepsToReproduce" value={reportData.stepsToReproduce} onChange={handleChange} required rows={4} className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700" placeholder="1. Go to checkout page...&#10;2. Leave phone empty...&#10;3. Click submit." />
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Severity *</label>
                        <select name="severity" value={reportData.severity} onChange={handleChange} required className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700">
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-gray-700 mb-2 font-medium">Expected Behavior</label>
                        <p className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-600 text-sm text-gray-700">{tc.expectedResults}</p>
                    </div>
                     <div>
                        <label className="block text-gray-700 mb-2 font-medium">Actual Result / Behavior</label>
                        <p className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-600 text-sm whitespace-pre-wrap text-gray-700">{actualResult}</p>
                    </div>
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Suggested Fix / Comment (Optional)</label>
                        <textarea name="suggestedFix" value={reportData.suggestedFix} onChange={handleChange} rows={2} className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700" />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border-2 border-gray-300">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg disabled:opacity-50">
                            {loading ? 'Submitting Report...' : 'Submit Fail Report'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Helper: Report Project Link Modal (Styling updated for dark mode) ---
const ReportLinkModal = ({ onClose, onSubmit, loading }: {
    onClose: () => void,
    onSubmit: (description: string) => Promise<void>,
    loading: boolean
}) => {
    // (Logic is unchanged, styling is)
    const [description, setDescription] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) {
            alert("Please provide a brief description of the issue.");
            return;
        }
        await onSubmit(description);
    };

    return (
        <div
            className="fixed inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={loading ? undefined : onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg border-4 border-red-800"
            >
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-700" />
                    <h2 className="text-2xl font-bold text-gray-800">Report Broken Project Link</h2>
                </div>
                <p className="text-gray-600 mb-4">
                    Are you sure the "View Live Project" link is broken or not working?
                    Submitting this report will <span className="font-bold text-red-700">lock this testing page</span> until the faculty and the other team resolve the issue.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-700 mb-2 font-medium">Issue Description *</label>
                        <textarea
                            name="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700"
                            placeholder="e.g., 'The link leads to a 404 error page.' or 'The site is down.'"
                            disabled={loading}
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border-2 border-gray-300">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2">
                            {loading ? 'Submitting...' : 'Confirm and Report Issue'}
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Helper: Single Test Case Card Component (Styling updated for dark mode) ---
const TestCaseCard = ({ tc, studentName, onDataMutate, isAssignmentComplete, isPageLocked }: {
    tc: TestCase,
    studentName: string,
    onDataMutate: () => void,
    isAssignmentComplete: boolean,
    isPageLocked: boolean
}) => {
    // (Logic is unchanged, styling is)
    const [uploading, setUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState('');
    const [showFailModal, setShowFailModal] = useState(false);
    const [actualResult, setActualResult] = useState(tc.actualResult || '');

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (file upload logic is unchanged)
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError('');
        try {
            const apiResponse = await fetch('/api/s3-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, filetype: file.type }),
            });
            if (!apiResponse.ok) throw new Error('Failed to get upload URL');
            const { presignedUploadUrl, publicFileUrl } = await apiResponse.json();

            const s3Response = await fetch(presignedUploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
            });
            if (!s3Response.ok) throw new Error('S3 upload failed');

            // @ts-ignore
            const success = await setTestcaseMetadataUrl(tc.id, publicFileUrl);
            if (!success) throw new Error('Failed to save metadata URL to database');
            
            onDataMutate();
        } catch (err: any) {
            setError(err.message || "Upload failed. Please try again.");
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveMetadata = async () => {
        // ... (remove metadata logic is unchanged)
        if (uploading || isDeleting || !tc.metadataImageUrl) return;
        if (!confirm("Are you sure you want to remove this screenshot? This will delete the file and cannot be undone.")) return;
        
        setUploading(true); 
        setError('');
        try {
            try {
                const urlParts = tc.metadataImageUrl.split('/');
                const fileKey = urlParts[urlParts.length - 1];
                
                const s3DeleteResponse = await fetch('/api/s3-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileKey }),
                });

                if (!s3DeleteResponse.ok) {
                    throw new Error("Failed to delete the file from S3.");
                }
            } catch (s3Error: any) {
                throw new Error(`S3 Deletion Failed: ${s3Error.message}`);
            }

            // @ts-ignore
            const success = await setTestcaseMetadataUrl(tc.id, null);
            if (!success) throw new Error('Failed to remove metadata from database');
            
            onDataMutate();
        } catch (err: any) {
            setError(err.message || "Failed to remove metadata.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        // ... (delete logic is unchanged)
        if (isDeleting) return;

        if (confirm(`Are you sure you want to delete this test case?\n[${tc.TID}] ${tc.testcaseName}`)) {
            setIsDeleting(true);
            setError('');
            try {
                if (tc.metadataImageUrl) {
                    try {
                        const urlParts = tc.metadataImageUrl.split('/');
                        const fileKey = urlParts[urlParts.length - 1];
                        
                        const s3DeleteResponse = await fetch('/api/s3-delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fileKey }),
                        });

                        if (!s3DeleteResponse.ok) {
                            console.warn("Could not delete S3 file, but proceeding with DB delete.");
                        }
                    } catch (s3Error) {
                        console.warn("S3 delete request failed, proceeding with DB delete.", s3Error);
                    }
                }

                // @ts-ignore
                const success = await deleteTestcase(tc.id);
                if (!success) throw new Error("Failed to delete test case.");
                
                onDataMutate();
            } catch (err: any) {
                setError(err.message || "Deletion failed.");
                setIsDeleting(false); 
            }
        }
    };

    const handleSubmitPass = async () => {
        // ... (submit pass logic is unchanged)
        if (!tc.metadataImageUrl) {
            alert("Please upload metadata (screenshot) before submitting.");
            return;
        }
        if (!actualResult.trim()) {
            alert("Please provide an 'Actual Result' before submitting.");
            return;
        }

        setSubmitLoading(true);
        setError('');
        try {
            const success = await submitTestResult(tc.id, 'pass', studentName, actualResult, null);
            if (!success) throw new Error("Submission failed.");
            onDataMutate(); 
        } catch (err: any) {
            setError(err.message || "Submission failed.");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleOpenFailModal = () => {
        // ... (open fail modal logic is unchanged)
        if (!tc.metadataImageUrl) {
            alert("Please upload metadata (screenshot) before submitting.");
            return;
        }
        if (!actualResult.trim()) {
            alert("Please provide an 'Actual Result' before submitting.");
            return;
        }
        setShowFailModal(true);
    };
    
    const isDisabled = isPageLocked || isAssignmentComplete || tc.testStatus !== 'pending';

    return (
        <>
            {showFailModal && (
                <FailReportModal
                    tc={tc}
                    studentName={studentName}
                    actualResult={actualResult}
                    onClose={() => setShowFailModal(false)}
                    onSubmitted={onDataMutate}
                />
            )}

            <div className={`bg-white border-2 border-gray-300 rounded-lg p-5 transition-all hover:shadow-md ${isPageLocked ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                    <h3 className="font-semibold text-xl text-red-800 flex-1">
                        {tc.TID && <span className="font-bold mr-2">[{tc.TID}]</span>}
                        {tc.testcaseName}
                    </h3>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={tc.testStatus} />
                        
                        {tc.testStatus === 'pending' && !isAssignmentComplete && !isPageLocked && (
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-100 rounded-md disabled:opacity-50"
                                title="Delete Test Case"
                            >
                                {isDeleting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </button>
                        )}
                    </div>
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

                {/* Metadata Upload/View Section */}
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                        {tc.metadataImageUrl ? (
                            <div className="flex items-center gap-2">
                                <a href={tc.metadataImageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-green-700 hover:underline font-medium">
                                    <FileText className="w-4 h-4 mr-1.5" />
                                    {tc.metadataImageUrl.split('/').pop()?.substring(0, 20)}...
                                </a>
                                
                                {tc.testStatus === 'pending' && !isAssignmentComplete && !isPageLocked && (
                                    <button
                                        onClick={handleRemoveMetadata}
                                        disabled={uploading}
                                        className="p-0.5 text-gray-500 hover:text-red-700 rounded-full hover:bg-red-100 disabled:opacity-50"
                                        title="Remove and re-upload screenshot"
                                    >
                                        {uploading ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                                        ) : (
                                            <XCircle className="w-4 h-4" />
                                        )}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <label className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer ${uploading || isDisabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-300'}`}>
                                <Upload className="w-4 h-4 mr-1.5" />
                                {uploading ? 'Uploading...' : 'Upload Screenshot *'}
                                <input type="file" onChange={handleFileUpload} disabled={uploading || isDisabled} className="hidden" />
                            </label>
                        )}
                    </div>
                </div>

                {/* Actual Result & Submit Buttons */}
                {tc.testStatus === 'pending' ? (
                    <div className="mt-4 space-y-3">
                        <div>
                            <label className="block text-gray-700 mb-2 font-medium text-sm">Actual Result (Required) *</label>
                            <textarea
                                name="actualResult"
                                value={actualResult}
                                onChange={(e) => setActualResult(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-sm text-gray-600 disabled:bg-gray-100"
                                placeholder="Describe what actually happened when you tested this."
                                disabled={submitLoading || isDisabled}
                            />
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={handleOpenFailModal}
                                disabled={!tc.metadataImageUrl || submitLoading || !actualResult.trim() || isDisabled}
                                className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title={isDisabled ? "Page is locked" : !tc.metadataImageUrl ? "Upload screenshot to enable" : !actualResult.trim() ? "Write actual result to enable" : ""}
                            >
                                <X className="w-4 h-4" /> Fail
                            </button>
                            <button
                                onClick={handleSubmitPass}
                                disabled={!tc.metadataImageUrl || submitLoading || !actualResult.trim() || isDisabled}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title={isDisabled ? "Page is locked" : !tc.metadataImageUrl ? "Upload screenshot to enable" : !actualResult.trim() ? "Write actual result to enable" : ""}
                            >
                                <Check className="w-4 h-4" /> Pass
                            </button>
                        </div>
                    </div>
                ) : (
                    // If already submitted, show results
                    <div className="mt-4">
                        <span className="text-sm font-medium text-gray-500">Test Submitted</span>
                        {tc.actualResult && (
                            <div className="mt-2 p-3 bg-white border-2 border-gray-200 rounded-lg">
                                <p className="text-sm font-medium text-gray-800">Actual Result:</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{tc.actualResult}</p>
                            </div>
                        )}
                        {tc.debuggingReport && (
                            <div className="mt-2 p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                                <p className="text-sm font-bold text-red-800 mb-2">Debugging Report (Severity: {tc.severity || 'N/A'})</p>
                                <div className="space-y-1 text-sm text-red-900">
                                    <p><span className="font-medium">Summary:</span> {tc.debuggingReport.issueSummary}</p>
                                    <p><span className="font-medium">Steps:</span> <span className="whitespace-pre-wrap">{tc.debuggingReport.stepsToReproduce}</span></p>
                                    {tc.debuggingReport.suggestedFix && (
                                        <p><span className="font-medium">Suggestion:</span> {tc.debuggingReport.suggestedFix}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            </div>
        </>
    );
};


// --- Helper: General Evaluation Component (Styling updated for dark mode) ---
const GeneralEvaluation = ({ data, onChange, disabled }: {
    data: EvaluationData,
    onChange: (data: EvaluationData) => void,
    disabled: boolean
}) => {
    // (Logic is unchanged, styling is)
    const questions = [
        { id: 'q1', text: 'The website/application loads correctly on the provided link.', options: ['Yes', 'No', 'Not Accessible'], tooltip: 'Confirms basic accessibility and loading.' },
        { id: 'q2', text: 'The core features described in the overview work as intended.', options: ['Yes', 'No'], tooltip: 'Testers must check at least one major feature.' },
        { id: 'q3', text: 'The interface is clear, usable, and responsive on different screen sizes.', options: ['Yes', 'No'], tooltip: 'Adjust browser window or mobile view.' },
        { id: 'q4', text: 'Error messages appear correctly for invalid or incomplete inputs.', options: ['Yes', 'No'], tooltip: 'Enter wrong data intentionally.' },
        { id: 'q5', text: 'Documentation (scope + sample test cases) was sufficient to understand how to test.', options: ['Yes', 'No'], tooltip: 'Evaluate clarity of shared information.' },
    ];

    const handleOptionChange = (qId: string, value: string) => {
        onChange({ ...data, [qId]: value });
    };

    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange({ ...data, comment: e.target.value });
    };

    return (
        <div className={`bg-white border-2 border-gray-300 rounded-xl p-8 shadow-sm mb-6 ${disabled ? 'opacity-70' : ''}`}>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Section A: General Evaluation</h3>
            <div className="space-y-6">
                {questions.map((q, index) => (
                    <div key={q.id} title={q.tooltip}>
                        <label className="block text-base font-medium text-gray-700 mb-3">
                            {index + 1}. {q.text}
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {q.options.map(option => (
                                <label key={option} className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-2 ${data[q.id as keyof EvaluationData] === option ? 'bg-red-800 text-white border-red-800' : 'bg-gray-50 hover:bg-white text-gray-800 border-gray-300'} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    <input
                                        type="radio"
                                        name={q.id}
                                        value={option}
                                        checked={data[q.id as keyof EvaluationData] === option}
                                        onChange={() => handleOptionChange(q.id, option)}
                                        disabled={disabled}
                                        className="hidden"
                                    />
                                    {option}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
                <div>
                    <label className="block text-base font-medium text-gray-700 mb-3">
                        Optional: Overall Feedback (max 200 chars)
                    </label>
                    <textarea
                        value={data.comment}
                        onChange={handleCommentChange}
                        disabled={disabled}
                        rows={3}
                        maxLength={200}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-sm text-gray-600 disabled:bg-gray-100"
                        placeholder="Provide any general feedback or comments here..."
                    />
                </div>
            </div>
        </div>
    );
};


// --- 4. MAIN PAGE COMPONENT (RESTORED) ---
export default function ProjectTestingDetails() {
    const router = useRouter();
    const params = useParams();
    const assignmentId = params.assignmentId as string;

    // --- State ---
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [projectDetails, setProjectDetails] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [markingComplete, setMarkingComplete] = useState(false);
    const [saveDraftLoading, setSaveDraftLoading] = useState(false);
    const [isPageLocked, setIsPageLocked] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [loadingTestCases, setLoadingTestCases] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [teamId, setTeamId] = useState<string | null>(null);
    const [evalData, setEvalData] = useState<EvaluationData>({
        q1: '', q2: '', q3: '', q4: '', q5: '', comment: ''
    });

    const [dataVersion, setDataVersion] = useState(0);
    const refreshData = () => setDataVersion(v => v + 1);

    // Fetch assignment/project details
    useEffect(() => {
        if (assignmentId) {
            fetchAssignmentsAndDetails(assignmentId);
        }
        if (typeof window !== 'undefined') {
            setStudentName(localStorage.getItem('userName') || 'Anonymous Tester');
            setTeamId(localStorage.getItem('teamId'));
        }
    }, [assignmentId]);

    // --- (ADD THIS ENTIRE BLOCK) ---
    // This new effect dynamically listens for locks
    useEffect(() => {
        // Don't do anything until the assignment (and its projectId) is loaded
        if (!assignment?.project.id) return;

        // 1. Create a query for all *active* reports for this project
        // We must create a new DocumentReference for the query
        const projectRef = doc(db, "projects", assignment.project.id);
        const reportsQuery = query(
            collection(db, "linkReports"),
            where("projectId", "==", projectRef),
            where("status", "in", ["OPEN", "PENDING_APPROVAL"])
        );

        // 2. Set up the live listener
        const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
            const hasActiveReport = !snapshot.empty;
            
            // 3. Set the lock state dynamically
            setIsPageLocked(hasActiveReport);
            
            if (hasActiveReport) {
                console.log("🔒 Live listener: Active report found. Page is LOCKED.");
            } else {
                console.log("✅ Live listener: No active reports. Page is UNLOCKED.");
            }
        }, (error) => {
            console.error("Error listening to link reports:", error);
        });

        // 4. Return cleanup function to stop listening when page is closed
        return () => {
            unsubscribe();
        };
        
    }, [assignment]); // This effect re-runs whenever the 'assignment' object changes
    // --- (END OF NEW BLOCK) ---

    // Fetches test cases (THIS WAS PART OF THE MISSING CODE)
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
    }, [assignmentId, dataVersion]);

    // Handle Save Draft
    const handleSaveDraft = async () => {
        if (!assignmentId) return;
        setSaveDraftLoading(true);
        try {
            await saveAssignmentEvaluation(assignmentId, evalData);
            alert("Draft saved successfully!");
        } catch (error: any) {
            alert(`Error saving draft: ${error.message}`);
        } finally {
            setSaveDraftLoading(false);
        }
    };

   // Handle Report Link Submit
    const handleReportSubmit = async (description: string) => {
        if (!assignmentId || !teamId) {
             alert("Error: User team ID not found. Please re-login.");
             return;
        }
        setReportLoading(true);
        
        try {
            const success = await reportProjectLink(assignmentId, description, teamId);
            
            if (success) {
                alert("Project link reported successfully. The page will now be locked until the issue is resolved.");
                setIsPageLocked(true);
                setIsReportModalOpen(false);
            } else {
                throw new Error("Failed to submit report. Please try again.");
            }
        } catch (error: any) {
            alert(`Error reporting link: ${error.message}`);
        } finally {
            setReportLoading(false);
        }
    };

    // Handle Mark As Tested (THIS WAS PART OF THE MISSING CODE)
    const handleMarkAsTested = async () => {
        if (!assignment) return;
        const isEvalComplete = evalData.q1 && evalData.q2 && evalData.q3 && evalData.q4 && evalData.q5;
        if (!isEvalComplete) {
            alert("Please complete all 5 questions in 'Section A: General Evaluation' before submitting.");
            return;
        }
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
            await saveAssignmentEvaluation(assignmentId, evalData);
            // @ts-ignore
            const result = await markAssignmentComplete(assignmentId, assignment.project.id);
            if (result.success) {
                alert("Assignment marked as complete!");
                await checkAndCompleteProject(assignment.project.id);
                fetchAssignmentsAndDetails(assignment.id);
                refreshData();
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

    // Data Fetching Function
    const fetchAssignmentsAndDetails = async (id: string) => {
        setLoading(true);
        setAssignment(null);
        setProjectDetails(null);
        try {
            const assignmentRef = doc(db, "assignments", id);
            const assignmentSnap = await getDoc(assignmentRef);

            if (!assignmentSnap.exists()) {
                throw new Error("Assignment not found");
            }
            const assignData = assignmentSnap.data() as {
                projectId: any;
                jiskaProjectTeamId: any;
                status: 'ASSIGNED' | 'COMPLETED' | 'LINK_REPORTED';
                evaluation?: EvaluationData;
            };

            // @ts-ignore
            const projectSnap = await getDoc(assignData.projectId);
            // @ts-ignore
            const originalTeamSnap = await getDoc(assignData.jiskaProjectTeamId);

            if (!projectSnap.exists() || !originalTeamSnap.exists()) {
                throw new Error("Project or Team data missing");
            }

            const projectData = projectSnap.data() as Omit<Project, 'id'>;
            const originalTeamData = originalTeamSnap.data() as { teamName: string };

            const loadedAssignment: Assignment = {
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
                evaluation: assignData.evaluation,
            };
            setAssignment(loadedAssignment);

            if (loadedAssignment.evaluation) {
                setEvalData(loadedAssignment.evaluation);
            }

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

    // --- RENDER THE PAGE ---
    return (
        <AuthCheck requiredRole="student">
            <div className="min-h-screen bg-gray-100">
                {<Header title="Project Testing" userRole={studentName} /> }
                
                <div className="max-w-6xl mx-auto px-6 py-8">
                    {/* Navigation Tabs */}
                    <div className="flex gap-4 mb-6">
                        <Link
                            href="/dashboard"
                            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/testing"
                            className="px-4 py-2 bg-red-800 text-gray-100 rounded-lg font-medium"
                        >
                            Project Testing
                        </Link>
                    </div>

                    {!assignment ? (
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
                        <div className="bg-white border-2 border-gray-300 rounded-xl p-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading Project Details...</p>
                        </div>
                    ) : (
                        <>
                            {/* Page Locked Banner */}
                            {isPageLocked && (
                                <div className="bg-red-100 border-2 border-red-300 text-red-800 p-4 rounded-lg mb-6 flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-bold">Testing Locked</h3>
                                        <p className="text-sm">The project link for this assignment has been reported as broken. This page is read-only until the issue is resolved by the faculty.</p>
                                    </div>
                                </div>
                            )}

                            {/* Project Info */}
                            <div className="bg-white border-2 border-gray-300 rounded-xl p-8 shadow-sm mb-6">
                                <div className="flex items-start gap-6">
                                    <FileText className="w-16 h-16 text-red-800 flex-shrink-0 mt-2" />
                                    <div className="flex-1">
                                        <h2 className="text-4xl font-bold text-gray-800 mb-4">
                                            {projectDetails.title}
                                        </h2>
                                        
                                        <div className="flex flex-wrap gap-4 mb-6 items-center">
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
                                            
                                            {projectDetails.deployedLink && !isPageLocked && assignment.status !== 'COMPLETED' && (
                                                <button
                                                    onClick={() => setIsReportModalOpen(true)}
                                                    // I ADDED THIS to remind myself just in case the code blows up
                                                    disabled={!teamId}
                                                    className="px-3 py-2 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border-2 border-transparent hover:border-red-200"
                                                >
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Project Link not working
                                                </button>
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
                                            <div className="bg-gray-50 bg-opacity-50 border border-gray-300 rounded-lg p-4 mb-3">
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
                                        {projectDetails.techStack && (
                                            <div>
                                                <span className="text-sm text-gray-600">
                                                    <strong>Tech Stack:</strong> {projectDetails.techStack}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* General Evaluation Section */}
                            <GeneralEvaluation
                                data={evalData}
                                onChange={setEvalData}
                                disabled={isPageLocked || assignment.status === 'COMPLETED'}
                            />
                            
                            {/* Save Draft Button */}
                            <button
                                onClick={handleSaveDraft}
                                disabled={isPageLocked || saveDraftLoading || markingComplete || assignment.status === 'COMPLETED'}
                                className="w-full py-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-lg border-2 border-gray-300 flex items-center justify-center gap-2 disabled:opacity-50 mb-6 disabled:cursor-not-allowed"
                            >
                                <Save className="w-5 h-5" />
                                {saveDraftLoading ? 'Saving...' : 'Save General Evaluation Draft'}
                            </button>


                            {/* --- THIS IS THE MISSING SECTION --- */}
                            <div className={`bg-white border border-gray-300 rounded-xl p-8 shadow-sm mb-6 ${isPageLocked ? 'opacity-70' : ''}`}>
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-2xl font-bold text-gray-800">Section B: Test Cases</h3>
                                        <button
                                            onClick={() => setShowModal(true)}
                                            disabled={isPageLocked || assignment.status === 'COMPLETED'}
                                            className="px-5 py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-lg font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Plus className="w-5 h-5" />
                                            Add Test Case
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {loadingTestCases ? (
                                            <p className="text-gray-600 text-center py-4">Loading test cases...</p>
                                        ) : testCases.length === 0 ? (
                                            <p className="text-gray-500 text-center py-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg">No test cases added yet. Click 'Add Test Case' to start.</p>
                                        ) : (
                                            testCases.map((tc) => (
                                                <TestCaseCard
                                                    key={tc.id}
                                                    tc={tc}
                                                    studentName={studentName}
                                                    onDataMutate={refreshData}
                                                    isAssignmentComplete={assignment.status === 'COMPLETED'}
                                                    isPageLocked={isPageLocked}
                                                />
                                            ))
                                        )}
                                    </div>

                                    {/* "Mark as Tested" Button Section */}
                                    {assignment.status !== 'COMPLETED' && (
                                        <div className="border-t-2 border-gray-300 pt-6 mt-6 space-y-4">
                                            
                                            <button
                                                onClick={handleMarkAsTested}
                                                disabled={isPageLocked || markingComplete || saveDraftLoading || testCases.filter(tc => tc.testStatus !== 'pending').length < MIN_TEST_CASES_THRESHOLD}
                                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-green-300"
                                                title={isPageLocked ? "Page is locked due to reported link" : testCases.filter(tc => tc.testStatus !== 'pending').length < MIN_TEST_CASES_THRESHOLD ? `Submit at least ${MIN_TEST_CASES_THRESHOLD} test case results first` : ""}
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                                {markingComplete ? 'Submitting...' : 'Mark Testing as Complete'}
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2 text-center">
                                                Requires all 5 evaluation questions to be answered AND {MIN_TEST_CASES_THRESHOLD} submitted test cases ({testCases.filter(tc => tc.testStatus !== 'pending').length} submitted). This action is final.
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
                            {/* --- END OF MISSING SECTION --- */}

                        </>
                    )}
                </div>
            </div>

            {/* Modal Render */}
            {showModal && assignmentId && assignment && (
                <AddTestModal
                    assignmentId={assignmentId}
                    teamId={assignment.originalTeam.id}
                    onClose={() => {
                        setShowModal(false);
                        refreshData();
                    }}
                    studentName={studentName}
                />
            )}
            
            {isReportModalOpen && (
                <ReportLinkModal
                    onClose={() => setIsReportModalOpen(false)}
                    onSubmit={handleReportSubmit}
                    loading={reportLoading}
                />
            )}
        </AuthCheck>
    );
}