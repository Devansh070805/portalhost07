'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthCheck from '../../components/AuthCheck'; // Adjust path
import { createTeam } from '../../../services/teams.js'; // Adjust path
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebaseConfig.js'; // Adjust path

export default function CreateTeam() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [hasTeam, setHasTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('userId');
    // <<< We get the teamName from localStorage here >>>
    const name = localStorage.getItem('teamName');

    if (id) {
      setUserId(id);
      const checkTeam = async () => {
        setLoading(true);
        const studentDoc = await getDoc(doc(db, 'students', id));
        if (studentDoc.exists() && studentDoc.data().teamId) {
          setHasTeam(true);
          // Sync localStorage just in case
          localStorage.setItem('teamId', studentDoc.data().teamId);
          // <<< ALSO SYNC THE TEAM NAME >>>
          if (studentDoc.data().teamName) {
            localStorage.setItem('teamName', studentDoc.data().teamName);
          }
        }
        // Set state from localStorage *or* the doc
        const teamNameFromStorage =
          localStorage.getItem('teamName') ||
          (studentDoc.exists() ? studentDoc.data().teamName : '');
        if (teamNameFromStorage) setTeamName(teamNameFromStorage);

        setLoading(false);
      };
      checkTeam();
    } else {
      router.push('/login'); // No user ID
    }
  }, [router]);

  // <<< 4. UPDATE your handleSubmit >>>
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError('User ID not found. Please log in again.');
      return;
    }
    if (hasTeam) {
      setError('You are already part of a team.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newTeamId = await createTeam(teamName, userId, [userId]);

      if (!newTeamId) {
        throw new Error('Failed to create team.');
      }

      // --- ⭐ THIS IS THE UPDATED BLOCK ---
      // We now save both the teamId AND the teamName to the student's doc
      const studentDocRef = doc(db, 'students', userId);
      await updateDoc(studentDocRef, {
        teamId: newTeamId,
        teamName: teamName, // <<< ADDED THIS LINE
      });

      // Also save both to localStorage for the app to use
      localStorage.setItem('teamId', newTeamId);
      localStorage.setItem('teamName', teamName); // <<< ADDED THIS LINE
      // --- ⭐ END OF UPDATED BLOCK ---

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border-2 border-gray-300 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (hasTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border-2 border-gray-300 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            You Already Have a Team
          </h1>
          <p className="text-gray-600 mb-6">
            You are already a member of a team. You can only create one team.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 bg-red-800 hover:bg-red-900 text-white rounded-lg font-semibold"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Your existing form
  return (
    <AuthCheck requiredRole="student" requiredStudentType="LEADER">
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border-2 border-gray-300">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Create Your Team
          </h1>
          <p className="text-center text-gray-600 mb-6">
            As a team leader, you need to create your team before you can submit a
            project.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2 font-medium">
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-red-800"
                required
              />
            </div>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-800 hover:bg-red-900 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating Team...' : 'Create Team'}
            </button>
          </form>
        </div>
      </div>
    </AuthCheck>
  );
}

