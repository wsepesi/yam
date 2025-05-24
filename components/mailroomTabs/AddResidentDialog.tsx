import { AlertCircle, Check, X } from "lucide-react";
import React, { useState } from "react";

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

interface AddResidentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onResidentAdded: () => void; // Callback to refresh list
  orgSlug: string;
  mailroomSlug: string;
}

export const AddResidentDialog: React.FC<AddResidentDialogProps> = ({
  isOpen,
  onClose,
  onResidentAdded,
  orgSlug,
  mailroomSlug,
}) => {
  const { session } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [residentId, setResidentId] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!firstName.trim()) {
      setError("First Name is required.");
      return;
    }
    if (!lastName.trim()) {
      setError("Last Name is required.");
      return;
    }
    if (!residentId.trim()) {
      setError("Resident ID is required.");
      return;
    }
    if (!session?.access_token) {
      setError("Authentication required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/add-resident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          resident: {
            first_name: firstName,
            last_name: lastName,
            resident_id: residentId,
            email,
          },
          orgSlug,
          mailroomSlug,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add resident.");
      }

      // Success
      setSuccess(`Resident ${firstName} ${lastName} added successfully.`);
      setFirstName("");
      setLastName("");
      setResidentId("");
      setEmail("");
      onResidentAdded(); // Refresh the residents list
    } catch (err) {
      console.error("Error adding resident:", err);
      setError(err instanceof Error ? err.message : "Failed to add resident.");
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
            Add New Resident
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#471803]/90">
            Enter the details for the new resident.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="flex items-center space-x-2 p-3 my-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded-none">
            <AlertCircle size={20} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-1">
              <X size={18} />
            </button>
          </div>
        )}
        {success && (
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
            <Label
              htmlFor="firstName"
              className="text-[#471803]/90 block mb-1.5"
            >
              First Name
            </Label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Label
              htmlFor="lastName"
              className="text-[#471803]/90 block mb-1.5"
            >
              Last Name
            </Label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Label
              htmlFor="residentId"
              className="text-[#471803]/90 block mb-1.5"
            >
              Resident ID
            </Label>
            <Input
              id="residentId"
              type="text"
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
              placeholder="Resident ID"
              className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-[#471803]/90 block mb-1.5">
              Email (optional)
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
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
                setFirstName("");
                setLastName("");
                setResidentId("");
                setEmail("");
              }}
              className="bg-white border border-[#471803]/50 text-[#471803] hover:bg-[#ffeedd] rounded-none px-4 py-2"
              disabled={isSubmitting}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="submit"
              className="bg-[#471803] hover:bg-[#471803]/90 text-white rounded-none px-4 py-2"
              disabled={isSubmitting || !firstName || !lastName || !residentId}
            >
              {isSubmitting ? "Adding..." : "Add Resident"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
