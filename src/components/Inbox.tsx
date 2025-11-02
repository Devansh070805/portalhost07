// src/components/Inbox.tsx
'use client';

import { useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Send,
    XCircle,
    Inbox as InboxIcon,
    ArrowRight,
    ExternalLink,
    MessageSquare,
    User,
    Users
} from 'lucide-react';

// --- (FIX 1) ---
// Import the corrected functions from your 'assignments' service
import {
    submitNewLinkForReport, // <-- Use the correct function name
    approveNewLink,
    declineNewLink
} from '../../services/assignments'; // <-- Use the correct file path

// Define the Report type (as imported by your pages)
export interface Report {
    id: string;
    status: 'OPEN' | 'PENDING_APPROVAL' | 'DECLINED' | 'CLOSED';
    proposedNewUrl?: string;
    logs: {
        timestamp: any; // Firestore Timestamp
        action: string;
        description?: string;
    }[];
    project: {
        id: string;
        title: string;
        deployedLink?: string; // The *current* link
    };
    // These are anonymized by the service before reaching the component
    uploadingTeam: {
        id?: string;
        teamName: string;
    };
    reportingTeam: {
        id?: string;
        teamName: string;
    };
}

interface InboxProps {
    role: 'faculty' | 'uploader' | 'tester';
    reports: Report[];
    onDataMutate: () => void; // Function to refetch all data
}

export default function Inbox({ role, reports, onDataMutate }: InboxProps) {
    if (reports.length === 0) {
        return (
            <div className="p-12 text-center text-gray-500">
                <InboxIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p>Your inbox is empty.</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-300">
            {reports.map((report) => (
                <ReportCard
                    key={report.id}
                    report={report}
                    role={role}
                    onDataMutate={onDataMutate}
                />
            ))}
        </div>
    );
}

// 1. Define a specific props interface for ReportCard
interface ReportCardProps {
    report: Report;
    role: 'faculty' | 'uploader' | 'tester';
    onDataMutate: () => void;
}

// --- Internal Card Component ---

// 2. Use the new ReportCardProps interface here
function ReportCard({ report, role, onDataMutate }: ReportCardProps) {
    const [newLink, setNewLink] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmitNewLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLink.trim()) {
            setError('Please provide a new, valid URL.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            // --- (FIX 2) ---
            // Call the correct function name
            const success = await submitNewLinkForReport(report.id, newLink); 
            if (!success) throw new Error('Failed to submit link.');
            onDataMutate(); // Refresh data
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!confirm('Are you sure you want to approve this link? This will close the report and unlock testing.')) return;
        setLoading(true);
        setError('');
        try {
            const success = await approveNewLink(report.id);
            if (!success) throw new Error('Failed to approve link.');
            onDataMutate();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError('Please provide a reason for declining.');
            return;
        }
        if (!confirm('Are you sure you want to decline this submission?')) return;
        setLoading(true);
        setError('');
        try {
            const success = await declineNewLink(report.id, reason);
            if (!success) throw new Error('Failed to decline link.');
            onDataMutate();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusInfo = () => {
        switch (report.status) {
            case 'OPEN':
                return {
                    Icon: AlertTriangle,
                    color: 'text-red-700',
                    text: 'Issue Reported: Link Broken'
                };
            case 'PENDING_APPROVAL':
                return {
                    Icon: Clock,
                    color: 'text-yellow-700',
                    text: 'Pending Faculty Approval'
                };
            case 'DECLINED':
                return {
                    Icon: XCircle,
                    color: 'text-red-700',
                    text: 'New Link Declined'
                };
            case 'CLOSED':
                return {
                    Icon: CheckCircle,
                    color: 'text-green-700',
                    text: 'Issue Resolved'
                };
            default:
                return { Icon: InboxIcon, color: 'text-gray-700', text: 'Unknown' };
        }
    };

    const { Icon, color, text } = getStatusInfo();

    // The rest of your component logic is correct
    return (
        <div className="p-5 hover:bg-gray-50">
            {/* Header: Status and Project Title */}
            <div className="flex justify-between items-center mb-3">
                <span className={`flex items-center gap-2 font-semibold ${color}`}>
                    <Icon className="w-5 h-5" />
                    {text}
                </span>
                <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    Project: {report.project.title}
                </span>
            </div>

            {/* Team Info (Anonymized by role) */}
            <div className="text-sm text-gray-500 mb-4 flex gap-6">
                <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Project Team: <span className="font-medium text-gray-700">{report.uploadingTeam.teamName}</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    Reporting Team: <span className="font-medium text-gray-700">{report.reportingTeam.teamName}</span>
                </span>
            </div>

            {/* Logs / History */}
            <div className="mb-4">
                <h4 className="font-medium text-gray-800 mb-2 text-sm">History:</h4>
                <div className="border-l-4 border-gray-300 pl-4 space-y-3 max-h-40 overflow-y-auto">
                    {/* --- (FIX 3) --- Sort by seconds, not the object --- */}
                    {report.logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds).map((log, index) => (
                        <div key={index} className="text-sm">
                            <p className="font-medium text-gray-700">{log.action}</p>
                            {log.description && (
                                <p className="text-gray-600 bg-gray-100 p-2 rounded-md mt-1 break-words">{log.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                                {/* @ts-ignore */}
                                {new Date(log.timestamp?.toDate()).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- ACTION PANELS --- */}

            {/* UPLOADER's Action Panel */}
            {role === 'uploader' && (report.status === 'OPEN' || report.status === 'DECLINED') && (
                <form onSubmit={handleSubmitNewLink} className="bg-red-50 border-2 border-red-200 p-4 rounded-lg space-y-3">
                    <p className="font-medium text-red-800">
                        {report.status === 'DECLINED' ? 'Your submission was declined. Please submit a new link.' : 'An issue was reported. Please submit an updated link.'}
                    </p>
                    <div className="flex gap-3">
                        <input
                            type="url"
                            value={newLink}
                            onChange={(e) => setNewLink(e.target.value)}
                            placeholder="https://your-new-updated-link.com"
                            required
                            className="flex-1 w-full px-4 py-2 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? 'Submitting...' : 'Submit New Link'} <Send className="w-4 h-4" />
                        </button>
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                </form>
            )}

            {/* FACULTY's Action Panel */}
            {role === 'faculty' && report.status === 'PENDING_APPROVAL' && (
                <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg space-y-4">
                    <div>
                        <p className="font-medium text-yellow-800 mb-2">Team submitted a new link for approval:</p>
                        <a
                            href={report.proposedNewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-700 hover:underline bg-white px-3 py-2 border border-gray-300 rounded-md inline-flex items-center gap-2 break-all"
                        >
                            {report.proposedNewUrl} <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>

                    {/* Decline Form */}
                    <form onSubmit={handleDecline} className="space-y-3">
                        <label className="block text-gray-700 mb-1 font-medium text-sm">Decline (Reason Required):</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g., 'The new link is also 404.' or 'Link works, but site crashes.'"
                            required
                            rows={2}
                            className="w-full px-4 py-2 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 text-gray-700"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? '...' : 'Decline'}
                            </button>
                            <button
                                type="button"
                                onClick={handleApprove}
                                disabled={loading}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? '...' : 'Approve & Close Issue'}
                            </button>
                        </div>
                    </form>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
            )}

            {/* --- Read-only Statuses --- */}
            {role === 'uploader' && report.status === 'PENDING_APPROVAL' && (
                <p className="p-3 text-center text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md">
                    <Clock className="w-4 h-4 inline mr-1.5" /> Pending faculty approval.
                </p>
            )}
            {role === 'tester' && (
                 <p className="p-3 text-center text-gray-700 bg-gray-100 border border-gray-200 rounded-md">
                    {report.status === 'CLOSED' ? 'This issue has been resolved.' : 'This issue is being handled by the project team and faculty.'}
                 </p>
            )}
            {report.status === 'CLOSED' && (
                <p className="p-3 text-center text-green-700 bg-green-50 border border-green-200 rounded-md">
                    <CheckCircle className="w-4 h-4 inline mr-1.5" /> Issue Resolved.
                </p>
            )}

        </div>
    );
}