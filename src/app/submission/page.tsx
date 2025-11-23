// src/app/submission/page.tsx
'use client';

import { Upload } from 'lucide-react';
import Header from '@/components/Header';
import AuthCheck from '@/components/AuthCheck';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitProject, getProjectsByTeam } from '../../../services/projects.js';
// --- NEW IMPORTS ---
import { getSubmissionSettings } from '../../../services/settings.js';
import { getFacultyEmailForTeam } from '../../../services/teams.js';
import { Timestamp } from 'firebase/firestore';

export default function ProjectSubmission() {
  const router = useRouter();
  const [userName, setUserName] = useState('Student'); // fallback name
  const [formData, setFormData] = useState({
    title: '',
    description: '', // This will now be populated by "Project Scope"
    deployedLink: '',
    githubLink: '',
    techStack: '',
    testCase1: '',
    testCase2: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- NEW STATE FOR DEADLINE CHECKS ---
  const [isSubmissionAllowed, setIsSubmissionAllowed] = useState(true); 
  const [deadlineMessage, setDeadlineMessage] = useState(""); 
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName') || 'Student';
      setUserName(storedName);
    }
  }, []);

  // --- NEW EFFECT: CHECK DEADLINE + EXISTING PROJECT ON MOUNT ---
  useEffect(() => {
    const checkEligibility = async () => {
      const teamId = localStorage.getItem('teamId');
      if (!teamId) {
        setCheckingEligibility(false);
        return;
      }

      try {
        // 🔹 1. Check if this team already has a project
        const existingProjects = await getProjectsByTeam(teamId);
        if (existingProjects && existingProjects.length > 0) {
          setIsSubmissionAllowed(false);
          setDeadlineMessage(
            "Your team has already submitted a project. You cannot submit another project."
          );
          setCheckingEligibility(false);
          return;
        }

        // 🔹 2. Find the Faculty Email for this team
        const facultyEmail = await getFacultyEmailForTeam(teamId);
        
        // 🔹 3. Get Settings for that specific faculty (or fallback behaviour inside service)
        const settings = await getSubmissionSettings(facultyEmail);

        // 🔹 4. Check Logic for deadline / manual toggle
        const now = new Date();
        
        // Check Manual Toggle
        if (settings.allowsSubmission === false) {
          setIsSubmissionAllowed(false);
          setDeadlineMessage("Submissions are currently disabled by your faculty.");
          setCheckingEligibility(false);
          return;
        }

        // Check Deadline Time
        if (settings.deadline) {
          // Convert Firestore Timestamp to JS Date
          const deadlineDate = settings.deadline instanceof Timestamp 
            ? settings.deadline.toDate() 
            : new Date(settings.deadline); 

          if (now > deadlineDate) {
            setIsSubmissionAllowed(false);
            setDeadlineMessage(`The submission deadline passed on ${deadlineDate.toLocaleString()}.`);
          } else {
            // Optional: show due time in console
            // console.log(`Due by: ${deadlineDate.toLocaleString()}`);
          }
        }
      } catch (err) {
        console.error("Error checking settings", err);
      } finally {
        setCheckingEligibility(false);
      }
    };

    checkEligibility();
  }, []);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const teamId = localStorage.getItem('teamId');

      if (!teamId) {
        setError('Team ID not found. Please login again.');
        setLoading(false);
        return;
      }

      const newProjectId = await submitProject({
        ...formData,
        teamId,
      });

      if (!newProjectId) {
        setError('Failed to submit project. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER BLOCKED UI IF DEADLINE PASSED OR PROJECT ALREADY EXISTS ---
  if (!checkingEligibility && !isSubmissionAllowed) {
    return (
       <AuthCheck requiredRole="student" requiredStudentType="LEADER">
          <div className="min-h-screen bg-gray-100">
            <Header title="Submission Closed" userRole={userName} />
            <div className="max-w-4xl mx-auto px-6 py-8 text-center">
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-8 shadow-sm">
                  <h2 className="text-2xl font-bold text-red-800 mb-2">Submission Closed</h2>
                  <p className="text-gray-700 mb-6">{deadlineMessage}</p>
                  <button 
                    onClick={() => router.push('/dashboard')} 
                    className="px-6 py-2 bg-red-800 text-white rounded hover:bg-red-800 transition-colors"
                  >
                    Return to Dashboard
                  </button>
              </div>
            </div>
          </div>
       </AuthCheck>
    );
 }

  return (
    <AuthCheck requiredRole="student" requiredStudentType="LEADER">
      <div className="min-h-screen bg-gray-100">
        <Header title="Project Submission" userRole={userName} />
        
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white border-2 border-gray-300 rounded-xl p-8 shadow-sm">
            
            <button 
              onClick={() => router.push('/dashboard')}
              className="mb-4 text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              ← Back to Dashboard
            </button>

            <h2 className="text-2xl font-bold text-gray-800 mb-6">New Project Submission</h2>
            
            {/* Show loading spinner if still checking deadline */}
            {checkingEligibility ? (
              <p className="text-gray-500">Checking submission status...</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Project Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Enter project title"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Project Scope *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe the scope and objectives of your project..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Test Case 1 Description *</label>
                  <textarea
                    name="testCase1"
                    value={formData.testCase1}
                    onChange={handleChange}
                    placeholder="Describe the first test case (e.g., 'User can login with correct credentials')..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Test Case 2 Description *</label>
                  <textarea
                    name="testCase2"
                    value={formData.testCase2}
                    onChange={handleChange}
                    placeholder="Describe the second test case (e.g., 'User sees an error on invalid login')..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Deployed Link</label>
                    <input
                      type="url"
                      name="deployedLink"
                      value={formData.deployedLink}
                      onChange={handleChange}
                      placeholder="https://your-project.com"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">GitHub Repository *</label>
                    <input
                      type="url"
                      name="githubLink"
                      value={formData.githubLink}
                      onChange={handleChange}
                      placeholder="https://github.com/username/repo"
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Tech Stack *</label>
                  <input
                    type="text"
                    name="techStack"
                    value={formData.techStack}
                    onChange={handleChange}
                    placeholder="React, Node.js, PostgreSQL, etc."
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                    <p className="text-green-700 text-sm">Project submitted successfully! Redirecting...</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  <Upload className="w-5 h-5" />
                  {loading ? 'Submitting...' : 'Submit Project'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </AuthCheck>
  );
}
