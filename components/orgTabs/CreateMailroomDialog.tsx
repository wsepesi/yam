import { AlertCircle, Check, X } from 'lucide-react'; // For messages
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import React, { useEffect, useState } from 'react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/context/AuthContext'; // For API calls

// MOCK_MODE: Set this to true to use mock API responses instead of real calls
const MOCK_MODE = false;
const MOCK_DELAY = {
  createMailroom: 2000,   // 2 seconds delay
  populateQueue: 3000,    // 3 seconds delay
  inviteManager: 1500     // 1.5 seconds delay
};

interface CreateMailroomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMailroomCreated: () => void; // Callback to refresh list
  organizationId: string | null; 
}

const generateSlug = (name: string): string => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return '';
  }
  const firstWord = trimmedName.split(' ')[0];
  return firstWord
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric characters except hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with a single one
};

export const CreateMailroomDialog: React.FC<CreateMailroomDialogProps> = ({
  isOpen,
  onClose,
  onMailroomCreated,
  organizationId
}) => {
  const { session } = useAuth();
  const [mailroomName, setMailroomName] = useState('');
  const [mailroomSlug, setMailroomSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStepMessage, setCurrentStepMessage] = useState('');
  const [filledDots, setFilledDots] = useState(0);
  const totalDots = 7; // Total number of dots in the progress indicator

  useEffect(() => {
    if (mailroomName) {
      setMailroomSlug(generateSlug(mailroomName));
    } else {
      setMailroomSlug('');
    }
  }, [mailroomName]);

  // Progress-based dot filling
  useEffect(() => {
    if (progress === 0) {
      setFilledDots(0);
    } else if (progress <= 33) {
      setFilledDots(2); // First milestone - mailroom creation
    } else if (progress <= 66) {
      setFilledDots(4); // Second milestone - queue population
    } else if (progress <= 99) {
      setFilledDots(6); // Third milestone - invitation sent
    } else {
      setFilledDots(totalDots); // Complete
    }
  }, [progress]);

  // Time-based "walking" animation during waiting periods
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isSubmitting && filledDots < totalDots) {
      let currentWalkingDot = filledDots;
      
      interval = setInterval(() => {
        // Only animate the "next" dot after the filled ones
        currentWalkingDot = (currentWalkingDot >= filledDots && currentWalkingDot < totalDots - 1) 
          ? currentWalkingDot + 1 
          : filledDots;
          
        setFilledDots(prev => {
          // If an API call has returned and updated filledDots, don't override that
          if (prev > currentWalkingDot) return prev;
          return currentWalkingDot;
        });
      }, 300);
    }
    
    return () => clearInterval(interval);
  }, [isSubmitting, filledDots, totalDots]);

  const getDotDisplay = () => {
    const emptyDot = '·';
    const filledDot = '●';
    
    const dotsArray = Array(totalDots).fill(emptyDot);
    
    // Fill in dots based on progress
    for (let i = 0; i < filledDots; i++) {
      dotsArray[i] = filledDot;
    }
    
    return dotsArray.join(' ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setProgress(0);
    setFilledDots(0);
    setCurrentStepMessage('');

    if (!mailroomName.trim()) {
      setError("Mailroom Name is required.");
      return;
    }
    if (!mailroomSlug.trim()) {
      setError("Mailroom Slug is required.");
      return;
    }
    if (!adminEmail.trim()) {
      setError("Manager Email is required.");
      return;
    }
    if (!organizationId) {
      setError("Organization ID is missing. Cannot create mailroom.");
      return;
    }
    if (!session?.access_token) {
      setError("Authentication required.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Starting mailroom creation
      setProgress(10);
      setCurrentStepMessage("Creating mailroom...");
      
      let newMailroomId;
      
      if (MOCK_MODE) {
        // MOCK: Create mailroom
        await new Promise(resolve => setTimeout(resolve, MOCK_DELAY.createMailroom));
        newMailroomId = 'mock-mailroom-id-' + Date.now();
      } else {
        // REAL: Create mailroom
        const createMailroomResponse = await fetch('/api/mailrooms/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name: mailroomName,
            slug: mailroomSlug,
            organizationId: organizationId,
            adminEmail: adminEmail,
          }),
        });

        const mailroomData = await createMailroomResponse.json();

        if (!createMailroomResponse.ok) {
          throw new Error(mailroomData.error || 'Failed to create mailroom.');
        }
        
        newMailroomId = mailroomData.id;
      }
      
      // Mailroom created successfully
      setProgress(33);
      setCurrentStepMessage("Mailroom created. Populating package queue...");

      if (MOCK_MODE) {
        // MOCK: Populate queue
        await new Promise(resolve => setTimeout(resolve, MOCK_DELAY.populateQueue));
      } else {
        // REAL: Populate the package queue
        const populateQueueResponse = await fetch('/api/mailrooms/populate-package-queue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ mailroomId: newMailroomId }),
        });

        const populateQueueData = await populateQueueResponse.json();

        if (!populateQueueResponse.ok) {
          throw new Error(populateQueueData.error || 'Mailroom created, but failed to populate package queue.');
        }
      }
      
      // Queue populated successfully
      setProgress(66);
      setCurrentStepMessage("Package queue populated. Sending manager invitation...");

      if (MOCK_MODE) {
        // MOCK: Invite manager
        await new Promise(resolve => setTimeout(resolve, MOCK_DELAY.inviteManager));
      } else {
        // REAL: Invite the manager
        const inviteManagerResponse = await fetch('/api/invitations/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: adminEmail,
            organizationId: organizationId,
            mailroomId: newMailroomId,
            role: 'manager', // Or 'admin' depending on desired role for creator
          }),
        });

        const invitationData = await inviteManagerResponse.json();

        if (!inviteManagerResponse.ok) {
          throw new Error(invitationData.error || 'Mailroom created and queue populated, but failed to send manager invitation.');
        }
      }

      // All steps completed
      setProgress(100);
      setCurrentStepMessage("All steps completed successfully!");
      setSuccess(`Mailroom "${mailroomName}" created, package queue populated, and invitation sent to ${adminEmail}.`);
      setMailroomName('');
      setMailroomSlug('');
      setAdminEmail('');
      onMailroomCreated(); // Refresh the list
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
      console.error("Error creating mailroom or inviting manager:", err);
      setCurrentStepMessage('An error occurred.'); // Update message on error
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-[#fffaf5] border-2 border-[#471803] rounded-none max-w-lg w-full">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#471803] text-xl">Create New Mailroom</AlertDialogTitle>
          <AlertDialogDescription className="text-[#471803]/90">
            Enter the details for the new mailroom and invite an initial manager.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isSubmitting && (
          <div className="my-4">
            <div className="text-sm text-[#471803]/80 mb-1">{currentStepMessage}</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 border border-[#471803]/30">
              <div
                className="bg-[#471803] h-2 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-center text-lg font-mono text-[#471803]/70 mt-2 tracking-widest">
              {getDotDisplay()}
            </div>
          </div>
        )}

        {error && !isSubmitting && (
          <div className="flex items-center space-x-2 p-3 my-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded-none">
            <AlertCircle size={20} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-1">
              <X size={18} />
            </button>
          </div>
        )}
        {success && !isSubmitting && (
          <div className="flex items-center space-x-2 p-3 my-2 bg-green-100 border border-green-400 text-green-700 text-sm rounded-none">
            <Check size={20} />
            <span>{success}</span>
             <button onClick={() => setSuccess(null)} className="ml-auto p-1">
              <X size={18} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="mailroomName" className="text-[#471803]/90 block mb-1.5">Mailroom Name</Label>
            <Input
              id="mailroomName"
              type="text"
              value={mailroomName}
              onChange={(e) => setMailroomName(e.target.value)}
              placeholder="e.g., Main Campus Center"
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Label htmlFor="mailroomSlug" className="text-[#471803]/90 block mb-1.5">Mailroom Slug</Label>
            <Input
              id="mailroomSlug"
              type="text"
              value={mailroomSlug}
              onChange={(e) => setMailroomSlug(generateSlug(e.target.value))} // Allow manual edit but keep auto-generation
              placeholder="e.g., main-campus-center"
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              disabled={isSubmitting}
            />
            <p className="text-xs text-[#471803]/70 mt-1">This will be part of the mailroom&apos;s URL. Auto-generated but can be adjusted. Refrain from using quantifiers like &quot;mailroom&quot; or &quot;center&quot; in the slug.</p>
          </div>
          <div>
            <Label htmlFor="adminEmail" className="text-[#471803]/90 block mb-1.5">Manager Email</Label>
            <Input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="Enter manager&apos;s email address"
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              disabled={isSubmitting}
            />
          </div>
          <AlertDialogFooter className="mt-6 pt-4 border-t border-[#471803]/20">
            <AlertDialogCancel
              onClick={() => {
                onClose();
                setError(null);
                setSuccess(null);
                setMailroomName('');
                setAdminEmail('');
              }}
              className="bg-white border border-[#471803]/50 text-[#471803] hover:bg-[#ffeedd] rounded-none px-4 py-2"
              disabled={isSubmitting}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="submit"
              className="bg-[#471803] hover:bg-[#471803]/90 text-white rounded-none px-4 py-2"
              disabled={isSubmitting || !mailroomName || !mailroomSlug || !adminEmail}
            >
              {isSubmitting ? 'Creating...' : 'Create Mailroom & Invite'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}; 