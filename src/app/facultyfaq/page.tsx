'use client';

// Removed: useState, useEffect
import { HelpCircle, ChevronLeft } from 'lucide-react';
// Removed: Header
// Removed: AuthCheck
import Link from 'next/link';

// Your FAQ content
const facultyFaqs = [
    {
        q: 'What do the 4 project statuses mean?',
        a: '• Completed: The project has been fully tested and marked complete by the testers.\n• Assigned: The project has testers and is either ready to be tested or is actively being tested.\n• Unassigned: The project has been submitted by the uploader but has no testers yet.\n• Blocked Link: A tester reported a broken link. The project is locked and requires your action in the inbox.',
    },
    {
        q: 'A link was reported. What is my role?',
        a: 'You are the final verifier.\n1. Wait: The uploading team must submit a new link first. You will see this as "Pending Approval" in your inbox.\n2. Act: Click the new link to test it yourself. If it works, click "Approve" to unlock the project. If it\'s still broken, click "Decline" and give a reason.',
    },
    {
        q: 'Where do I see all the reports?',
        a: 'Click the Inbox icon in the top-right corner of your dashboard. This shows all reports that are open or pending your approval.',
    },
    {
        q: 'How do I re-assign or un-assign a project?',
        a: 'Go to the "Assignments" page and click "Reassign" on any project.\n• To Re-assign: Select one or two new teams and confirm.\n• To Un-assign: Select "-- Clear Assignment --" for both slots and confirm. This will delete the old assignments and mark the project as "Unassigned".',
    },
    {
        q: 'What\'s the difference between "Propose Random" and "Manual Assignment"?',
        a: '• Propose Random: This is for assigning *all* unassigned projects at once. It suggests teams, but you **must** click **"Confirm All"** to make the assignments real.\n• Manual Assignment: This is for assigning *one* project. The change is instant and does not need a separate confirmation step.',
    },
];

export default function FacultyFaqPage() {
    // Removed: userName state and useEffect

    return (
        // Removed: AuthCheck wrapper
        <div className="min-h-screen bg-gray-100 pb-20">
            {/* Removed: Header component */}

            {/* Added pt-12 for spacing since header is gone */}
            <div className="max-w-3xl mx-auto px-6 py-8 pt-12 md:pt-16">
                <div className="mb-6">
                    <Link
                        href="/login" // <-- CHANGED
                        className="inline-flex items-center text-gray-600 hover:text-red-800 font-medium"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        Back to Login {/* <-- CHANGED */}
                    </Link>
                </div>

                <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b-2 border-gray-300 bg-gray-50 flex items-center gap-3">
                        <HelpCircle className="w-8 h-8 text-red-800" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                Faculty FAQ
                            </h1>
                            <p className="text-gray-600">
                                Answers to common questions about managing the platform.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">
                        {facultyFaqs.map((faq, index) => (
                            <div
                                key={index}
                                className="pt-6 border-t-2 border-gray-200 first:pt-0 first:border-t-0"
                            >
                                <h3 className="text-lg font-semibold text-gray-800">
                                    {faq.q}
                                </h3>
                                <p className="mt-2 text-gray-700 whitespace-pre-line">
                                    {faq.a}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        // Removed: Closing </AuthCheck>
    );
}