// src/app/testing/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react'; // Original import
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';

import { getProjectsAssignedToTeam } from '../../../services/projects'; // Adjust path

interface Assignment {
    id: string; // Assignment ID
    project: { // Project being tested
        id: string;
        title: string;
    };
    originalTeam: { // Team that submitted the project
        id: string;
        teamName: string;
    };
    status: string; // Status of the assignment
}


// --- MAIN PAGE COMPONENT (MODIFIED) ---
export default function ProjectTestingList() {
    // --- State ---
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [studentName, setStudentName] = useState('');

    // Fetch assignments ONCE on initial load
    useEffect(() => {
        fetchAssignments();

        if (typeof window !== 'undefined') {
            setStudentName(localStorage.getItem('userName') || 'Anonymous Tester');
        }
    }, []);

    // Fetches all assignments
    const fetchAssignments = async () => {
        setLoading(true);
        setAssignments([]);
        try {
            const teamId = localStorage.getItem('teamId');
            if (!teamId) {
                setLoading(false);
                return;
            }

            const data = await getProjectsAssignedToTeam(teamId);
            const assignmentsData = (data || []) as Assignment[];

            // Filter for *all* active assignments
            const activeAssignments = assignmentsData.filter(a => a.status !== 'COMPLETED');
            setAssignments(activeAssignments);

        } catch (error) {
            console.error('Error fetching data:', error);
            setAssignments([]);
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
                        <p className="mt-4 text-gray-600">Loading Assignments...</p>
                    </div>
                </div>
            </AuthCheck>
        );
    }

    // --- RENDER THE PAGE ---
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
                    
                    {assignments.length === 0 ? (
                        // No active assignment found (Original UI)
                        <div className="bg-white border-2 border-gray-300 rounded-xl p-12 text-center">
                            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-600 mb-2">
                                No Active Testing Assignment
                            </h3>
                            <p className="text-gray-500">
                                You currently have no project assigned for testing.
                            </p>
                        </div>
                    ) : (
                        // List all active assignments (Original UI with requested tweaks)
                        <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm">
                            <div className="px-6 py-4 border-b-2 border-gray-300">
                                <h2 className="text-xl font-bold text-gray-800">Your Active Testing Assignments</h2>
                            </div>
                            <div className="divide-y divide-gray-300">
                                {assignments.map((assign) => (
                                <Link
                                    key={assign.id}
                                    href={`/testing/${assign.id}`}
                                    // Original padding and hover
                                    className="p-6 hover:bg-gray-50 block transition-colors"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            {/* --- CHANGE 1: Size increased, margin removed --- */}
                                            <h3 className="text-2xl font-bold text-red-800">
                                                {assign.project.title}
                                            </h3>
                                            {/* --- CHANGE 2: "Submitted by" <p> tag removed --- */}
                                        </div>
                                        {/* Original Status Span */}
                                        <span
  className={`px-3 py-1 rounded-full text-sm font-medium ${
    assign.status === 'COMPLETED'
      ? 'bg-green-100 text-green-700'
      : assign.status === 'ASSIGNED'
      ? 'bg-blue-100 text-blue-700'
      : assign.status === 'UNASSIGNED'
      ? 'bg-yellow-100 text-yellow-700'
      : assign.status === 'BLOCKED_LINK'
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-700'
  }`}
>
  {assign.status === 'UNASSIGNED'
    ? 'Unassigned'
    : assign.status === 'ASSIGNED'
    ? 'Assigned'
    : assign.status === 'COMPLETED'
    ? 'Completed'
    : assign.status === 'BLOCKED_LINK'
    ? 'Blocked'
    : assign.status}
</span>

                                    </div>
                                </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthCheck>
    );
}