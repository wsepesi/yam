import { AlertCircle, Check, X } from "lucide-react";
import React, { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

// MOCK_MODE: Set this to true to use mock API responses instead of real calls
const MOCK_MODE = true; // Set to true as requested
const MOCK_DELAY = {
  createOrganization: 1500, // 1.5 seconds delay for creating organization
};

interface CreateOrganizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOrganizationCreated: () => void;
}

interface OrganizationResponseData {
  name: string;
  slug: string;
  status: string;
  id: string;
  error?: string;
}

export const CreateOrganizationDialog: React.FC<
  CreateOrganizationDialogProps
> = ({ isOpen, onClose, onOrganizationCreated }) => {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("PENDING_SETUP"); // Default status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // Added for progress bar
  const [currentStepMessage, setCurrentStepMessage] = useState(""); // Added for progress message
  const [filledDots, setFilledDots] = useState(0); // Added for dot animation
  const totalDots = 3; // Simplified dot animation for single step

  useEffect(() => {
    // Reset form when dialog is closed/opened
    if (isOpen) {
      setName("");
      setSlug("");
      setStatus("PENDING_SETUP");
      setIsSubmitting(false);
      setError(null);
      setSuccess(null);
      setProgress(0); // Reset progress
      setCurrentStepMessage(""); // Reset message
      setFilledDots(0); // Reset dots
    }
  }, [isOpen]);

  // Progress-based dot filling (simplified for one main step)
  useEffect(() => {
    if (progress === 0) {
      setFilledDots(0);
    } else if (progress < 100) {
      setFilledDots(1); // In progress
    } else {
      setFilledDots(totalDots); // Complete
    }
  }, [progress, totalDots]);

  // Time-based "walking" animation during waiting periods
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSubmitting && filledDots < totalDots) {
      let currentWalkingDot = filledDots;

      interval = setInterval(() => {
        currentWalkingDot =
          currentWalkingDot >= filledDots && currentWalkingDot < totalDots - 1
            ? currentWalkingDot + 1
            : filledDots;

        setFilledDots((prev) => {
          if (prev > currentWalkingDot) return prev;
          return currentWalkingDot;
        });
      }, 300);
    }

    return () => clearInterval(interval);
  }, [isSubmitting, filledDots, totalDots]);

  const getDotDisplay = () => {
    const emptyDot = "·";
    const filledDot = "●";

    const dotsArray = Array(totalDots).fill(emptyDot);

    for (let i = 0; i < filledDots; i++) {
      dotsArray[i] = filledDot;
    }

    return dotsArray.join(" ");
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawSlug = e.target.value;
    const sanitizedSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "")
      .replace(/-+/g, "-");
    setSlug(sanitizedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setProgress(0); // Reset progress
    setFilledDots(0); // Reset dots
    setCurrentStepMessage(""); // Reset message

    if (!name.trim() || !slug.trim()) {
      setError("Organization Name and Slug are required.");
      return;
    }

    setIsSubmitting(true);
    // Start creating organization
    setProgress(10);
    setCurrentStepMessage("Creating organization...");

    let responseData: OrganizationResponseData; // Use defined type

    try {
      if (MOCK_MODE) {
        await new Promise((resolve) =>
          setTimeout(resolve, MOCK_DELAY.createOrganization)
        );
        responseData = { name, slug, status, id: `mock-org-${Date.now()}` }; // Mock response
      } else {
        if (!session?.access_token) {
          // Check session token only if not in MOCK_MODE
          setError("Authentication required.");
          setIsSubmitting(false); // Also set isSubmitting to false
          setProgress(0); // Reset progress on auth error
          setCurrentStepMessage("Authentication failed."); // Set message on auth error
          return;
        }
        const response = await fetch("/api/organizations/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name, slug, status }),
        });

        responseData = await response.json();

        if (!response.ok) {
          throw new Error(
            responseData.error ||
              `Failed to create organization: ${response.status}`
          );
        }
      }

      setProgress(100); // Creation complete
      setCurrentStepMessage("Organization created successfully!");
      setSuccess(`Organization '${responseData.name}' created successfully!`);
      onOrganizationCreated();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "An unexpected error occurred while creating the organization."
        );
      }
      setCurrentStepMessage("An error occurred."); // Update message on error
      setProgress(0); // Reset progress on error
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-[#fffaf5] border-2 border-[#471803] rounded-none max-w-lg w-full">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#471803] text-xl">
            Create New Organization
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#471803]/90">
            Enter the details for the new organization.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isSubmitting && (
          <div className="my-4">
            <div className="text-sm text-[#471803]/80 mb-1">
              {currentStepMessage}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 border border-[#471803]/30">
              <div
                className="bg-[#471803] h-2 rounded-full"
                style={{ width: `${progress}%` }}
              />
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
            <Label htmlFor="orgName" className="text-[#471803]/90 block mb-1.5">
              Organization Name
            </Label>
            <Input
              type="text"
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              placeholder="e.g., Acme Corporation"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label htmlFor="orgSlug" className="text-[#471803]/90 block mb-1.5">
              Organization Slug
            </Label>
            <Input
              type="text"
              id="orgSlug"
              value={slug}
              onChange={handleSlugChange}
              required
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              placeholder="e.g., acme-corp (auto-sanitized)"
              disabled={isSubmitting}
            />
            {slug && (
              <p className="text-xs text-[#471803]/70 mt-1">
                Generated slug: {slug}
              </p>
            )}
          </div>

          <AlertDialogFooter className="mt-6 pt-4 border-t border-[#471803]/20">
            <AlertDialogCancel
              onClick={() => {
                onClose();
                setError(null); // Also clear errors/success on cancel
                setSuccess(null);
                setName("");
                setSlug("");
                setStatus("PENDING_SETUP");
                setProgress(0);
                setCurrentStepMessage("");
                setFilledDots(0);
              }}
              className="bg-white border border-[#471803]/50 text-[#471803] hover:bg-[#ffeedd] rounded-none px-4 py-2"
              disabled={isSubmitting}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={isSubmitting || !name || !slug}
              className="bg-[#471803] hover:bg-[#471803]/90 text-white rounded-none px-4 py-2"
            >
              {isSubmitting ? "Creating..." : "Create Organization"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
