import { AlertCircle, Check, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

interface Manager {
  id: string;
  email: string;
  role: 'user' | 'manager' | 'admin';
  created_at: string;
  status?: 'INVITED' | 'ACTIVE' | 'REMOVED';
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  status: 'PENDING' | 'RESOLVED' | 'FAILED';
}

export default function ManageManagers() {
  const router = useRouter();
  const { session } = useAuth();
  const { org, mailroom } = router.query;

  const [managers, setManagers] = useState<Manager[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mailroomId, setMailroomId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMailroomDetails = async () => {
      if (!org || !mailroom || !session) return;

      try {
        const response = await fetch(`/api/mailrooms/details?orgSlug=${org}&mailroomSlug=${mailroom}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch mailroom details');
        }
        setMailroomId(data.mailroomId);
        setOrganizationId(data.organizationId);
      } catch (err) {
        console.error('Error fetching mailroom details:', err);
        setError('Failed to load mailroom details. Functionality may be limited.');
      }
    };

    if (router.isReady) {
      fetchMailroomDetails();
    }
  }, [org, mailroom, session, router.isReady]);

  useEffect(() => {
    if (router.isReady && mailroomId && session) {
      fetchManagersAndInvitations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, mailroomId, session]);

  const fetchManagersAndInvitations = async () => {
    if (!session) {
      setError("Session expired or not available. Please log in again.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch all users for the mailroom (includes managers and admins)
      const usersRes = await fetch(`/api/users/mailroom?mailroomId=${mailroomId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const usersData = await usersRes.json();
      console.log(usersData);
      
      if (usersRes.ok) {
        // Filter for users who are managers or admins AND are ACTIVE
        const actualManagers = usersData.users.filter(
          (user: Manager) => (user.role === 'manager' || user.role === 'admin') && user.status === 'ACTIVE'
        );
        setManagers(actualManagers);
      } else {
        console.error('Failed to fetch users:', usersData.error);
        // Optionally set an error state for users/managers here
      }
      
      // Fetch pending invitations for managers
      const invitationsRes = await fetch(`/api/invitations?mailroomId=${mailroomId}&role=manager`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const invitationsData = await invitationsRes.json();
      
      if (invitationsRes.ok) {
        console.log('invitationsData', invitationsData)
        setPendingInvitations(invitationsData);
      } else {
        console.error('Failed to fetch invitations:', invitationsData.error);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteManager = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter an email address');
      return;
    }
    
    if (!mailroomId || !organizationId) {
      setError('Mailroom or Organization information is missing. Cannot send invitation.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!session) {
        setError('You must be logged in to send invitations');
        setIsSubmitting(false);
        return;
      }
      const response = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email,
          organizationId: organizationId,
          mailroomId: mailroomId,
          role: 'manager' // Specific role for managers
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to send invitation');
        return;
      }
      
      setSuccess(`Invitation sent to ${email}`);
      setEmail('');
      
      // Refresh the invitations list
      fetchManagersAndInvitations();
    } catch (err) {
      console.error('Error sending invitation:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveManager = async (managerId: string) => {
    try {
      if (!session) {
        setError('You must be logged in to remove managers');
        // setIsSubmitting(false); // Consider removing if setIsSubmitting is not used here or set to false in a finally block
        return;
      }

      // Find the manager to check their role
      const managerToRemove = managers.find(manager => manager.id === managerId);

      if (managerToRemove && managerToRemove.role === 'admin') {
        setError('Admin users cannot be removed.');
        setSuccess(null); // Clear any previous success message
        return;
      }

      // If mailroomId is not available, prevent the action.
      // This check might be redundant if mailroomId is always expected to be present
      // when this component is active and this function is callable.
      // However, adding it for robustness if that's a concern.
      if (!mailroomId) {
        setError('Mailroom information is missing. Cannot remove manager.');
        setSuccess(null);
        return;
      }

      setIsSubmitting(true); // Set submitting state at the beginning of the async operation
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/managers/${managerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          role: 'user', // Downgrade from manager to user
          status: 'REMOVED', // Set status to REMOVED
          mailroomId: mailroomId
        }),
      });
      
      if (response.ok) {
        setManagers(prev => 
          prev.filter(manager => manager.id !== managerId)
        );
        setSuccess('Manager removed successfully');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove manager');
      }
    } catch (err) {
      console.error('Error removing manager:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false); // Ensure isSubmitting is reset regardless of outcome
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-medium text-[#471803]">Manage Mailroom Managers</h2>
      
      {/* Invite Manager Form */}
      <div className="p-6 bg-white border border-[#471803]/20 w-full h-[20vh]">
        <div className="flex justify-between items-center pb-2">
          <h3 className="text-lg font-medium text-[#471803]">Invite New Manager</h3>
          
          {/* Error and Success messages moved here */}
          {error && (
            <div className="flex items-center space-x-2 p-2 bg-red-100 border border-red-400 text-red-700 text-sm max-w-[60%]">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X size={16} />
              </button>
            </div>
          )}
          
          {success && (
            <div className="flex items-center space-x-2 p-2 bg-green-100 border border-green-400 text-green-700 text-sm max-w-[60%]">
              <Check size={16} />
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="ml-auto">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
        
        <form onSubmit={handleInviteManager} className="flex items-end gap-4">
          <div className="flex-grow space-y-1">
            <Label htmlFor="email" className="text-[#471803]/90">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email to invite"
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              disabled={isSubmitting}
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={isSubmitting || !mailroomId || !organizationId}
            className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
          >
            {isSubmitting ? 'Sending Invitation...' : 'Invite as Manager'}
          </Button>
        </form>
      </div>
      
      {/* Tables Container - New structure for two-column layout */}
      <div className="flex gap-2 w-full">
        {/* Pending Invitations List - Moved First */}
        <div className="p-6 bg-white border border-[#471803]/20 w-1/2">
          <h3 className="text-lg font-medium text-[#471803] mb-4">Pending Invitations</h3>
          
          <div className="h-[30vh] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex space-x-4">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-4 w-1/5" />
                  </div>
                ))}
              </div>
            ) : pendingInvitations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#471803]/20">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Email</th>
                      {/* <th className="px-3 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Expires</th> */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#471803]/10">
                    {pendingInvitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#471803]">{invitation.email}</td>
                        {/* <td className="px-3 py-4 whitespace-nowrap text-sm text-[#471803]">{formatDate(invitation.expiresAt)}</td> */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            invitation.status === 'PENDING' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : invitation.status === 'RESOLVED' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {invitation.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[#471803]/70 italic">No pending invitations</p>
            )}
          </div>
        </div>

        {/* Current Managers List - Moved Second */}
        <div className="p-6 bg-white border border-[#471803]/20 w-1/2">
          <h3 className="text-lg font-medium text-[#471803] mb-4">Current Managers</h3>
          
          <div className="h-[30vh] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex space-x-4">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-4 w-1/5" />
                    <Skeleton className="h-4 w-1/5" />
                  </div>
                ))}
              </div>
            ) : managers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#471803]/20">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Email</th>
                      {/* <th className="px-2 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Name</th> */}
                      <th className="px-3 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Joined</th>
                      <th className="pl-3 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#471803]/10">
                    {managers.map((manager) => (
                      <tr key={manager.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#471803]">{manager.email}</td>
                        {/* <td className="px-2 py-4 whitespace-nowrap text-sm text-[#471803] capitalize">{manager.name || 'N/A'}</td> */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-[#471803]">{formatDate(manager.created_at)}</td>
                        <td className="pl-3 py-4 whitespace-nowrap text-sm text-[#471803]">
                          {manager.role !== 'admin' && (
                            <Button 
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                              onClick={() => handleRemoveManager(manager.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[#471803]/70 italic">No managers found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 