// components/TeamManagement.tsx
'use client';

import { useState } from 'react';
// <<< 1. IMPORT THE NEW FUNCTION AND ICONS >>>
import { sendInvite } from '../../services/invites'; // Adjust path
import { getTeamMembersDetails } from '../../services/teams'; // Adjust path
import { User, Star } from 'lucide-react';

// <<< 2. UPDATE THE PROPS INTERFACE >>>
interface TeamManagementProps {
  leaderId: string; // The ID of the team leader
  teamId: string;
  teamName: string;
  currentUserId: string;
  teamMemberRefs: any[]; // The array of DocumentReferences
}

// <<< 3. DEFINE A TYPE FOR A STUDENT MEMBER >>>
interface StudentMember {
  id: string;
  name: string;
  email: string;
  type: 'LEADER' | 'MEMBER';
}

export default function TeamManagement({ leaderId, teamId, teamName, teamMemberRefs, currentUserId }: TeamManagementProps) {
  // --- Existing state for invites ---
  const [email, setEmail] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isLeader = currentUserId === leaderId;

  // <<< 4. ADD NEW STATE FOR VIEWING MEMBERS >>>
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<StudentMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // <<< 5. CREATE A FUNCTION TO FETCH/TOGGLE MEMBERS >>>
  const handleViewMembers = async () => {
    // Toggle visibility
    setShowMembers(!showMembers);

    // If we are opening it and members haven't been loaded yet
    if (!showMembers && members.length === 0) {
      setLoadingMembers(true);
      try {
        const memberData = await getTeamMembersDetails(teamMemberRefs);
        setMembers(memberData as StudentMember[]);
      } catch (err) {
        setError("Could not load team members.");
      } finally {
        setLoadingMembers(false);
      }
    }
  };

  // --- Existing handleSubmit for invites ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingInvite(true); // Use the specific loader
    setError(null);
    setSuccess(null);

    try {
      await sendInvite(leaderId, teamId, teamName, email);
      setSuccess(`Invite successfully sent to ${email}!`);
      setEmail('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingInvite(false); // Use the specific loader
    }
  };

  // <<< 6. UPDATE THE JSX >>>
  return (
    <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm mt-8">
      <div className="px-6 py-4 border-b-2 border-gray-300 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">
  Team Management <span className="text-red-800">({teamName})</span>
</h2>

        {/* View Members Button */}
        <button
          onClick={handleViewMembers}
          className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
        >
          {showMembers ? 'Hide Members' : 'View Members'} ({teamMemberRefs.length})
        </button>
      </div>

      {/* Conditional Member List */}
      {showMembers && (
        <div className="p-6 border-b-2 border-gray-300">
          <h3 className="font-semibold text-gray-800 mb-4">Current Team Members</h3>
          {loadingMembers ? (
            <p className="text-gray-500">Loading members...</p>
          ) : (
            <ul className="space-y-3">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between p-3 bg-gray-50 border-2 border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-500" />
                    <div>
                      <span className="font-medium text-gray-900">{member.name}</span>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  
                  {/* Highlight the team leader */}
                  {member.id === leaderId && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      <Star className="w-3 h-3" />
                      Leader
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Existing Invite Form */}
      {isLeader ? (
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-gray-700 mb-2 font-medium">Invite New Member</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter member's email"
            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-800 placeholder-gray-400 text-gray-800"
            required
          />
        </div>
        {error && <p className="text-red-700 text-sm">{error}</p>}
        {success && <p className="text-green-700 text-sm">{success}</p>}
        <button
          type="submit"
          disabled={loadingInvite}
          className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loadingInvite ? 'Sending...' : 'Send Invite'}
        </button>
      </form>
      ) : null }
    </div>
  );
}