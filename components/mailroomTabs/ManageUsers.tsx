import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

type User = {
  id: string;
  role: 'user' | 'manager' | 'admin';
  created_at: string;
  email: string;
  status?: 'INVITED' | 'ACTIVE' | 'REMOVED';
};

type Invitation = {
  id: string;
  email: string;
  role: 'user' | 'manager' | 'admin';
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
    } catch (err) {
      console.error('Error sending invitation:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <div className="p-2 bg-red-100 border border-red-400 text-red-700 text-sm max-w-[60%]">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-2 bg-green-100 border border-green-400 text-green-700 text-sm max-w-[60%]">
              {success}
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
        <div className="p-6 bg-white border border-[#471803]/20 w-1/2">
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#471803]/20">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Email</th>
                      {/* <th className="px-2 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Role</th> */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Status</th>
                      {/* <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Sent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Expires</th> */}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#471803]/10">
                    {invitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#471803]">{invitation.email}</td>
                        {/* <td className="px-2 py-4 whitespace-nowrap text-sm text-[#471803] capitalize">{invitation.role}</td> */}
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
                        {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-[#471803]">{formatDate(invitation.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#471803]">{formatDate(invitation.expires_at)}</td> */}
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
        <div className="p-6 bg-white border border-[#471803]/20 w-1/2">
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#471803]/20">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Email</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#471803]/70 uppercase tracking-wider">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#471803]/10">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#471803]">
                          {user.email || "N/A"}
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-[#471803] capitalize">{user.role}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#471803]">{formatDate(user.created_at)}</td>
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
    </div>
  );
};

export default ManageUsers;