import { AlertCircle, Check, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

type User = {
  id: string;
  role: 'user' | 'manager' | 'admin' | 'super-admin';
  created_at: string;
  email: string;
  status?: 'INVITED' | 'ACTIVE' | 'REMOVED';
};

type Invitation = {
  id: string;
  email: string;
  role: 'user' | 'manager' | 'admin' | 'super-admin';
  created_at: string;
  expires_at: string;
  status: 'PENDING' | 'RESOLVED' | 'FAILED';
};

const ManageUsers: React.FC = () => {
  const router = useRouter();
  const { org: organizationSlug, mailroom: mailroomSlug } = router.query;
  const { session } = useAuth();
  
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [mailroomId, setMailroomId] = useState<string | null>(null);
  const [showRemoveUserConfirm, setShowRemoveUserConfirm] = useState(false);
  const [userToRemove, setUserToRemove] = useState<User | null>(null);
  
  // Fetch organization and mailroom details
  useEffect(() => {
    const fetchMailroomDetails = async () => {
      if (!organizationSlug || !mailroomSlug || !session) return;
      
      try {
        console.log('Fetching mailroom details for:', { organizationSlug, mailroomSlug });
        
        // Use the session from auth context
        const response = await fetch(`/api/mailrooms/details?orgSlug=${organizationSlug}&mailroomSlug=${mailroomSlug}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        const data = await response.json();
        
        console.log('API response status:', response.status, response.statusText);
        console.log('API response data:', data);
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch mailroom details');
        }
        
        setOrganizationId(data.organizationId);
        setMailroomId(data.mailroomId);
        console.log('Successfully set organization and mailroom IDs:', data);
      } catch (err) {
        console.error('Error fetching mailroom details:', err);
        setError('Failed to load mailroom details');
      }
    };
    
    fetchMailroomDetails();
  }, [organizationSlug, mailroomSlug, session]);
  
  // Fetch users and invitations once we have the mailroom ID
  useEffect(() => {
    const fetchUsers = async () => {
      if (!mailroomId || !session) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/users/mailroom?mailroomId=${mailroomId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch users');
        }
        
        // Filter users to only include those with status 'ACTIVE'
        setUsers(data.users.filter((user: User) => user.status === 'ACTIVE'));
        setInvitations(data.invitations.filter((invitation: Invitation) => invitation.role === 'user'));
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [mailroomId, success, session]);
  
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter an email address');
      return;
    }
    
    if (!organizationId || !mailroomId) {
      setError('Organization or mailroom information is missing');
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
          organizationId,
          mailroomId,
          role: 'user' // Default role for new invites
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to send invitation');
        return;
      }
      
      setSuccess(`Invitation sent to ${email}`);
      setEmail('');
      // Refresh users and invitations after sending invite
      if (mailroomId && session) {
        fetchUsersAndInvitations();
      }
    } catch (err) {
      console.error('Error sending invitation:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const promptRemoveUser = (user: User) => {
    // Prevent admins or managers from being removed from this simplified user management UI
    // They should be managed in ManageManagers if applicable
    if (user.role === 'admin' || user.role === 'manager' || user.role === 'super-admin') {
        setError('Admins, Super-Admins and Managers cannot be removed from this interface. Please use the Manage Managers tab for managers.');
        setSuccess(null);
        return;
    }
    setUserToRemove(user);
    setShowRemoveUserConfirm(true);
  };

  const confirmRemoveUser = async () => {
    if (!userToRemove || !session || !mailroomId) {
      setError('Required information is missing to remove the user.');
      setShowRemoveUserConfirm(false);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/users/${userToRemove.id}/status`, { // Assuming this endpoint updates user status
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status: 'REMOVED',
          mailroomId: mailroomId // Include mailroomId if API requires it to scope the status change
        }),
      });

      if (response.ok) {
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userToRemove.id));
        setSuccess(`User ${userToRemove.email} removed successfully.`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove user.');
      }
    } catch (err) {
      console.error('Error removing user:', err);
      setError('An unexpected error occurred while removing the user.');
    } finally {
      setIsSubmitting(false);
      setShowRemoveUserConfirm(false);
      setUserToRemove(null);
    }
  };
  
  const fetchUsersAndInvitations = async () => { // Renamed from fetchUsers for clarity
    if (!mailroomId || !session) return;

    setLoading(true);
    try {
      // Fetch active users
      const usersResponse = await fetch(`/api/users/mailroom?mailroomId=${mailroomId}&status=ACTIVE`, { // Ensure we only fetch active users initially
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!usersResponse.ok) throw new Error((await usersResponse.json()).error || 'Failed to fetch users');
      const usersData = await usersResponse.json();
      setUsers(usersData.users || []); // Assuming API returns { users: [] }

      // Fetch pending user invitations
      const invitationsResponse = await fetch(`/api/invitations?mailroomId=${mailroomId}&role=user&status=PENDING`, { // Fetch only PENDING user invitations
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!invitationsResponse.ok) throw new Error((await invitationsResponse.json()).error || 'Failed to fetch invitations');
      const invitationsData = await invitationsResponse.json();
      setInvitations(invitationsData || []); // Assuming API returns an array directly or { invitations: [] }
      
    } catch (err: unknown) {
      console.error('Error fetching users or invitations:', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to load data.');
      } else {
        setError('An unknown error occurred while fetching data.');
      }
    } finally {
      setLoading(false);
    }
  };

  // useEffect to call fetchUsersAndInvitations
  useEffect(() => {
    if (mailroomId && session) {
      fetchUsersAndInvitations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailroomId, session]); // Removed 'success' from deps to avoid re-fetching on every success message. Fetch is explicit after invite.

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-medium text-[#471803]">Manage Users</h2>
      
      {/* Invite User Form */}
      <div className="p-6 bg-white border border-[#471803]/20 w-full h-[20vh]">
        <div className="flex justify-between items-center pb-2">
          <h3 className="text-lg font-medium text-[#471803]">Invite New User</h3>
          
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
        
        <form onSubmit={handleInviteUser} className="flex items-end gap-4">
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
            disabled={isSubmitting || !organizationId || !mailroomId}
            className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
          >
            {isSubmitting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>
      </div>
      
      {/* Tables Container */}
      <div className="flex gap-2 w-full">
        {/* Pending Invitations */}
        <div className="p-6 bg-white border border-[#471803]/20 w-2/5 min-w-0">
          <h3 className="text-lg font-medium text-[#471803] mb-4">Invitations</h3>
          
          <div className="h-[30vh] overflow-y-auto">
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex space-x-4">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-4 w-1/5" />
                  </div>
                ))}
              </div>
            ) : invitations.length > 0 ? (
              <div className="w-full">
                <table className="w-full table-fixed divide-y divide-[#471803]/20">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="w-3/5 px-2 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider truncate">Email</th>
                      <th className="w-2/5 px-2 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#471803]/10">
                    {invitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td className="w-3/5 px-2 py-4 text-sm text-[#471803] truncate" title={invitation.email}>
                          {invitation.email}
                        </td>
                        <td className="w-2/5 px-2 py-4 text-sm">
                          <span className={`px-1 py-1 text-xs font-semibold rounded ${
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
              <p className="text-[#471803]/70 italic">No invitations found</p>
            )}
          </div>
        </div>
        
        {/* Current Users */}
        <div className="p-6 bg-white border border-[#471803]/20 w-3/5 min-w-0">
          <h3 className="text-lg font-medium text-[#471803] mb-4">Current Users</h3>
          
          <div className="h-[30vh] overflow-y-auto">
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex space-x-4">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-4 w-1/5" />
                    <Skeleton className="h-4 w-1/5" />
                  </div>
                ))}
              </div>
            ) : users.length > 0 ? (
              <div className="w-full">
                <table className="w-full table-fixed divide-y divide-[#471803]/20">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="w-2/5 px-2 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider truncate">Email</th>
                      <th className="w-1/5 px-1 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Role</th>
                      <th className="w-1/5 px-2 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Joined</th>
                      <th className="w-1/5 px-1 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#471803]/10">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="w-2/5 px-2 py-4 text-sm text-[#471803] truncate" title={user.email || "N/A"}>
                          {user.email || "N/A"}
                        </td>
                        <td className="w-1/5 px-1 py-4 text-sm text-[#471803] capitalize truncate">{user.role}</td>
                        <td className="w-1/5 px-2 py-4 text-sm text-[#471803] truncate">{formatDate(user.created_at)}</td>
                        <td className="w-1/5 px-1 py-4 text-sm text-[#471803]">
                          {user.role === 'user' && ( // Only show remove for 'user' role
                            <Button
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                              onClick={() => promptRemoveUser(user)}
                              disabled={isSubmitting}
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
              <p className="text-[#471803]/70 italic">No users found</p>
            )}
          </div>
        </div>
      </div>

      {userToRemove && (
        <AlertDialog
          open={showRemoveUserConfirm}
          onOpenChange={setShowRemoveUserConfirm}
        >
          <AlertDialogContent className="bg-[#fffaf5] border-2 border-[#471803] rounded-none">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#471803]">Are you sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-[#471803]/90">
                This action will remove user {userToRemove.email} from this mailroom. Their status will be set to &apos;REMOVED&apos;. This action cannot be undone directly from this interface.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel
                onClick={() => {
                  setShowRemoveUserConfirm(false);
                  setUserToRemove(null);
                }}
                className="bg-white border border-[#471803]/50 text-[#471803] hover:bg-[#ffeedd] rounded-none"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveUser}
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white rounded-none"
              >
                {isSubmitting ? 'Removing...' : 'Confirm Removal'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default ManageUsers;