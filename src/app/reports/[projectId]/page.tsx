'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Download, Shield, Star, Zap, Lock } from 'lucide-react';
import Header from '@/components/Header'; // Adjust path as needed
import AuthCheck from '@/components/AuthCheck'; // Adjust path as needed

// We need a simple function to get project details
// You must create this in your services/projects.js file
// Example:
// export const getProjectById = async (projectId) => {
//   const docRef = doc(db, 'projects', projectId);
//   const docSnap = await getDoc(docRef);
//   return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
// };
import { getProjectById } from '../../../../services/projects'; // Adjust path as needed

interface Project {
  id: string;
  title: string;
}

export default function ReportDownloadPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const storedUserName = localStorage.getItem('userName') || 'Student';
    setUserName(storedUserName);

    if (projectId) {
      const fetchProject = async () => {
        setLoading(true);
        const projectData = (await getProjectById(projectId)) as Project | null;
        setProject(projectData);
        setLoading(false);
      };
      fetchProject();
    }
  }, [projectId]);

  // This is the placeholder function for the payment flow
  const handlePremiumPurchase = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // --- THIS IS WHERE YOUR PAYMENT LOGIC GOES ---
    // 1. You would call your payment provider (Razorpay, Stripe) here.
    // 2. On success, the provider's callback would update the DB (e.g., set 'hasPaidPremiumReport = true').
    // 3. For this demo, we'll just show an alert and then start the download.
    
    alert('Contact at out support service to get your paid version of the Report!');
    
    // After the alert, we proceed to the download link.
    // In a real app, you would only do this *after* a successful payment callback.
    // window.open(`/api/reports/project/${projectId}?censored=false`, '_blank');
  };

  if (loading || !project) {
    return (
      <AuthCheck requiredRole="student">
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading Report Options...</p>
          </div>
        </div>
      </AuthCheck>
    );
  }

  return (
    <AuthCheck requiredRole="student">
      <div className="min-h-screen bg-gray-100">
        <Header title="Project Reports" userRole={userName} />

        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900">Download Report</h1>
            <p className="text-xl text-gray-600 mt-2">
              For your project: <span className="font-semibold text-red-800">{project.title}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* --- FREE - CENSORED REPORT --- */}
            <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm flex flex-col hover:-translate-y-1">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-8 h-8 text-red-800" />
                  <h2 className="text-2xl font-bold text-gray-800">Standard Report</h2>
                </div>
                <p className="text-gray-600 mb-6 text-sm min-h-[50px]">
                  A censored report that hides all tester identities. Perfect for a standard review.
                </p>
                <ul className="text-sm text-gray-700 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-800" />
                    Tester names and details are hidden
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-800" />
                    Testing team names are anonymized
                  </li>
                </ul>
              </div>
              
              <div className="mt-auto p-6 bg-gray-50 rounded-b-xl">
                <a
                  href={`/api/reports/project/${projectId}?censored=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center px-4 py-3 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Free
                </a>
              </div>
            </div>

           {/* --- PREMIUM - GOLD EDITION --- */}
<div className="relative overflow-hidden rounded-xl border border-yellow-400/50 bg-gradient-to-br from-[#fff8db] via-[#ffe9a9] to-[#ffd875] shadow-[0_4px_18px_rgba(255,200,0,0.35)] transition-transform hover:-translate-y-1">
  <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-[10px] font-semibold uppercase rounded-bl-lg tracking-wider shadow-lg">
    Premium
  </div>

  <div className="p-6">
    <div className="flex items-center gap-3 mb-3">
      <Star className="w-8 h-8 text-amber-600 drop-shadow-sm" />
      <h2 className="text-2xl font-bold text-gray-800">Premium Report</h2>
    </div>

    <p className="text-gray-700 mb-6 text-sm min-h-[50px]">
      The full, uncensored report. See exactly who tested your project and their detailed feedback.
    </p>

    <ul className="text-sm text-gray-800 space-y-2 mb-6">
      <li className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-600" />
        All tester names and details revealed
      </li>
      <li className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-600" />
        Full testing team information
      </li>
    </ul>
  </div>

  <div className="mt-auto p-6 bg-[#fff5d6] rounded-b-xl border-t border-yellow-300/40">
    <button
      onClick={handlePremiumPurchase}
      className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-white rounded-lg text-sm font-semibold gap-2 shadow-md transition-all"
    >
      <Zap className="w-4 h-4" />
      Buy Premium Report (₹199)
    </button>
  </div>
</div>

          </div>
          
          <div className="text-center mt-12">
            <Link href="/dashboard" className="text-gray-600 hover:text-red-800 text-sm font-medium">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </AuthCheck>
  );
}