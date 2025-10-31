// src/app/faculty/project/[projectId]/page.tsx
'use client';

import { FileText, ExternalLink, Github, Download, CheckCircle, Eye } from 'lucide-react';
import Header from '@/components/Header';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function TeamPageDetails() {
  const params = useParams();
  const projectId = params.projectId as string;

  const exampleTests = [
    { id: 1, title: 'User Registration', expected: 'User can register with email and password', result: 'Pass' },
    { id: 2, title: 'Product Search', expected: 'Users can search products by name/category', result: 'Pass' },
    { id: 3, title: 'Add to Cart', expected: 'Products can be added to cart successfully', result: 'Pass' },
    { id: 4, title: 'Checkout Process', expected: 'Complete payment and order placement', result: 'Pass' },
  ];

  const evaluatorTests = [
    { id: 1, no: '001', title: 'Login Authentication', expected: 'Secure login with valid credentials', actual: 'Working as expected', result: 'Pass', image: 'screenshot1.png' },
    { id: 2, no: '002', title: 'Payment Gateway', expected: 'Process payment with Stripe', actual: 'Payment successful', result: 'Pass', image: 'screenshot2.png' },
    { id: 3, no: '003', title: 'Order Confirmation Email', expected: 'Email sent after order', actual: 'Email received within 2 minutes', result: 'Pass', image: 'screenshot3.png' },
    { id: 4, no: '004', title: 'Product Filter', expected: 'Filter by price range', actual: 'Filters working correctly', result: 'Pass', image: 'screenshot4.png' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="Project Details - Team Alpha" userRole="Coordinator" />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Link
          href="/faculty/dashboard"
          className="mb-6 inline-block px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
        >
          ← Back to Dashboard
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Info */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4 mb-6">
                <FileText className="w-16 h-16 text-red-800" />
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">E-Commerce Platform</h2>
                  <p className="text-gray-600 mb-4">Submitted by Team Alpha</p>
                  <div className="flex gap-3">
                    <a href="#" className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 inline-flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />View Live
                    </a>
                    <a href="#" className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 inline-flex items-center gap-2">
                      <Github className="w-4 h-4" />GitHub
                    </a>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2">
                      <Download className="w-4 h-4" />Download SRS
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-gray-300 pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Project Description</h3>
                <p className="text-gray-700 mb-4">
                  A comprehensive e-commerce platform featuring user authentication, product catalog, shopping cart, 
                  payment integration, order management, and admin dashboard. Built with React, Node.js, Express, 
                  and PostgreSQL.
                </p>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Tech Stack</h4>
                  <p className="text-gray-700">React, Node.js, Express, PostgreSQL, Stripe API, AWS S3</p>
                </div>
              </div>
            </div>

            {/* Example Test Cases */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Example Test Cases (by Team Alpha)</h3>
              <div className="space-y-3">
                {exampleTests.map((test) => (
                  <div key={test.id} className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 mb-1">{test.title}</h4>
                        <p className="text-gray-600 text-sm">{test.expected}</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">{test.result}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Cases by Evaluators */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Test Cases by Team Beta (Evaluators)</h3>
              <div className="space-y-4">
                {evaluatorTests.map((test) => (
                  <div key={test.id} className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
                    <div className="grid grid-cols-6 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Test No</p>
                        <p className="font-semibold text-gray-800">{test.no}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-600 mb-1">Test Title</p>
                        <p className="font-semibold text-gray-800">{test.title}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-600 mb-1">Expected Result</p>
                        <p className="text-gray-700 text-sm">{test.expected}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Result</p>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{test.result}</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-300 pt-3">
                      <p className="text-xs text-gray-600 mb-2">Actual Result</p>
                      <p className="text-gray-700 text-sm mb-3">{test.actual}</p>
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-gray-600" />
                        <button className="text-sm text-blue-600 hover:underline">{test.image}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Report Summary */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Testing Report Summary</h3>
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h4 className="font-bold text-green-800">Testing Complete</h4>
                </div>
                <p className="text-green-700 text-sm">All test cases passed successfully. Project is ready for deployment.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">4</p>
                  <p className="text-sm text-gray-600">Passed</p>
                </div>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">0</p>
                  <p className="text-sm text-gray-600">Failed</p>
                </div>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">4</p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Information */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Team Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Team Name</p>
                  <p className="font-semibold text-gray-800">Team Alpha</p>
                </div>
                <div>
                  <p className="text-gray-600">Team Leader</p>
                  <p className="font-semibold text-gray-800">Something</p>
                </div>
                <div>
                  <p className="text-gray-600">Members</p>
                  <p className="text-gray-800">Something, Something2</p>
                </div>
                <div>
                  <p className="text-gray-600">Submission Date</p>
                  <p className="font-semibold text-gray-800">2025-10-10</p>
                </div>
              </div>
            </div>

            {/* Testing Details */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Testing Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Tested By</p>
                  <p className="font-semibold text-gray-800">Team Beta</p>
                </div>
                <div>
                  <p className="text-gray-600">Test Date</p>
                  <p className="font-semibold text-gray-800">2025-10-15</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Completed</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Actions</h3>
              <div className="space-y-3">
                <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" />
                  Download Full Report
                </button>
                <button className="w-full py-3 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                  View All Screenshots
                </button>
                <button className="w-full py-3 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                  Export as PDF
                </button>
              </div>
            </div>

            {/* Tests Made by This Team */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Tests Made by Team Alpha</h3>
              <p className="text-sm text-gray-600 mb-3">For Team XYZ Project</p>
              <button className="w-full py-3 bg-red-800 hover:bg-red-900 text-white rounded-lg font-medium inline-flex items-center justify-center gap-2">
                <Eye className="w-5 h-5" />
                View Their Test Cases
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}