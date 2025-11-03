'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvite } from '../../services/invites.js'; // Adjust path if needed

export default function InviteHandler({
  invites,
  userId,
  onAccepted,
}: {
  invites: any[];
  userId: string;
  onAccepted?: (teamId?: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null); // Store ID of invite being accepted
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (inviteId: string) => {
    setLoading(inviteId);
    setError(null);

    try {
      // --- ⭐ MODIFICATION ---
      // Your 'acceptInvite' service function MUST be updated
      // to return { success, teamId, teamName }
      const { success, teamId, teamName } = await acceptInvite(inviteId, userId);

if (success && teamId && teamName) {
  localStorage.setItem('teamId', teamId);
  localStorage.setItem('teamName', teamName);
  localStorage.setItem('studentType', 'MEMBER');
  setLoading(null);

  if (typeof onAccepted === 'function') {
    await onAccepted(teamId);
  } else {
    router.refresh?.();
  }
}
 else {
        // Handle cases where the invite failed or didn't return all data
        setError(
          'Failed to accept invite. The team may no longer exist.'
        );
        setLoading(null);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="bg-white border-2 border-gray-300 rounded-xl p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Pending Invitations
        </h1>
        {invites.length === 0 ? (
          <p className="text-gray-600">You have no pending team invitations.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              You have been invited to join the following teams:
            </p>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="p-4 border-2 border-gray-200 rounded-lg flex items-center justify-between"
              >
                <span className="font-semibold">{invite.teamName}</span>
                <button
                  onClick={() => handleAccept(invite.id)}
                  disabled={loading === invite.id}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {loading === invite.id ? 'Accepting...' : 'Accept Invite'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

