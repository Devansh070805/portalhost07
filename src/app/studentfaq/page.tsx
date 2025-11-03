'use client';

// Removed: useState, useEffect
import { HelpCircle, ChevronLeft } from 'lucide-react';
// Removed: Header
// Removed: AuthCheck
import Link from 'next/link';

// Your FAQ content
const studentFaqs = [
    {
        q: 'Is the testing anonymous?',
        a: 'Yes. As a tester, you won\'t see the uploader\'s name. As an uploader, you will only see "A Testing Team" reported your link. Only the faculty can see both sides.',
    },
    {
        q: 'What do I do if a project link is broken?',
        a: 'Click the "Report link not working" button. This instantly locks the testing page and notifies the uploading team and faculty. You can resume testing once the faculty approves the new, fixed link.',
    },
    {
        q: 'Why is my testing page locked?',
        a: 'The project\'s link was reported as broken by you or another tester. The page is locked for everyone until the uploading team fixes it and the faculty approves the new link.',
    },
    {
        q: 'My project link was reported! What do I do?',
        a: 'You\'ll get an email and an "Issue" in your dashboard inbox.\n1. Fix your project and deploy it to a new URL.\n2. Go to your dashboard inbox and submit this new link in the form.\n3. Wait for the faculty to check and approve it.',
    },
    {
        q: 'The faculty "Declined" my new link. Now what?',
        a: 'It means your new link was also broken. You must fix the project *again*, get a new URL, and submit it in the same inbox thread.',
    },
    {
        q: 'How do I "Mark Testing as Complete"?',
        a: 'You must do two things:\n1. Answer all 5 questions in the "Section A: General Evaluation" form.\n2. Add and submit results (Pass/Fail) for at least the minimum number of required test cases.',
    },
];

export default function StudentFaqPage() {
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
                                Student FAQ
                            </h1>
                            <p className="text-gray-600">
                                Answers to common questions for Uploaders and Testers.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">
                        {studentFaqs.map((faq, index) => (
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