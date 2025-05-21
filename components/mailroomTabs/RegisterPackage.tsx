import { AcProps, Package as PackageType, Resident } from '@/lib/types';
import { AlertCircle, Package, X } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEffect, useState } from 'react';

import AutocompleteWithDb from '@/components/AutocompleteWithDb';
import { MailroomTabProps } from '@/lib/types/MailroomTabProps';
import ReportName from '@/components/ReportName';
import { useAuth } from '@/context/AuthContext';
import { z } from 'zod';

const carriers = ["Amazon", "USPS", "UPS", "Fedex", "Letter", "Other"] as const;

const packageSchema = z.object({
  resident: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    student_id: z.string()
  }),
  carrier: z.enum(carriers)
});

interface PackageAlert extends PackageType {
  id: string;
}

export default function Register({ orgSlug, mailroomSlug }: MailroomTabProps) {
  const { session } = useAuth();
  const [addingPackage, setAddingPackage] = useState(false);
  const [alerts, setAlerts] = useState<PackageAlert[]>([]);
  const [carrier, setCarrier] = useState<(typeof carriers)[number] | null>(null);
  const [record, setRecord] = useState<Resident | null>(null);
  const [noName, setNoName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error when form state changes
  useEffect(() => {
    if (error) setError(null);
  }, [record, carrier, error]);

  const failPackage = async (pkg: PackageType) => {
    setAddingPackage(false);
    // Remove the alert for failed packages
    setRecord(null);
    setCarrier(null);

    if (!session) {
      setError('You must be logged in to send invitations');
      return;
    }

    await fetch('/api/fail-package', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
       },
      body: JSON.stringify(pkg)
    });
  };

  const handleSubmit = async () => {
    try {
      // Validate form data
      const validatedData = packageSchema.parse({
        resident: record,
        carrier
      });

      setAddingPackage(true);
      setError(null);

      const pkg = {
        First: validatedData.resident.first_name,
        Last: validatedData.resident.last_name,
        Email: validatedData.resident.email,
        provider: validatedData.carrier,
        residentId: validatedData.resident.student_id,
        orgSlug,
        mailroomSlug
      };
      if (!session) {
        setError('You must be logged in to send invitations');
        setAddingPackage(false);
        return;
      }
      console.log(pkg);
      const res = await fetch('/api/add-package', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
         },
        body: JSON.stringify({ ...pkg, orgSlug, mailroomSlug })
      });

      if (!res.ok) {
        if (res.status === 501) {
          console.error('Unforeseen error. Please contact support.');
          setError('An unexpected error occurred. Please contact support.');
        } else {
          console.log("Entering failure recovery mode");
          const failedPackage = await res.json();
          await failPackage(failedPackage);
        }
      } else {
        const addedPackage = await res.json();
        const alertId = Math.random().toString(36).substring(7);
        setAlerts(prev => [...prev, { ...addedPackage, id: alertId }]);
        setAddingPackage(false);
        setRecord(null);
        setCarrier(null);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError('Please fill in all required fields correctly.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      console.error('Error adding package:', err);
    } finally {
      setAddingPackage(false);
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const acProps: AcProps<Resident> = {
    apiRoute: orgSlug && mailroomSlug ? `get-residents?orgSlug=${encodeURIComponent(orgSlug)}&mailroomSlug=${encodeURIComponent(mailroomSlug)}` : 'get-residents',
    acLabel: 'Resident',
    displayOption: (resident: Resident) => `${resident.last_name}, ${resident.first_name}`,
    record,
    setRecord: (newRecord) => {
      setRecord(newRecord);
      if (!newRecord) setCarrier(null);
    },
    setLoaded: () => {},
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined
  };

  return (
    <div className="w-full max-w-2xl h-full relative flex flex-col">
      <h2 className="text-xl font-medium text-[#471803] mb-2">Register Package</h2>

      {!addingPackage && (
        <div className="space-y-8">
          <div>
            <AutocompleteWithDb {...acProps} />
          </div>

          {record && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-5">
              <div>
                <label className="block text-sm font-medium text-[#471803] mb-4">
                  Select the Package Carrier
                </label>
                <RadioGroup
                  value={carrier || ""}
                  onValueChange={(value) => setCarrier(value as typeof carriers[number])}
                  className="grid grid-cols-3 gap-4"
                >
                  {carriers.map((c) => (
                    <div key={c} className="flex items-center space-x-2">
                      <RadioGroupItem value={c} id={c} className="border-[#471803] text-[#471803]" />
                      <label
                        htmlFor={c}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-[#471803]"
                      >
                        {c}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {carrier && (
                <div className="animate-in fade-in slide-in-from-left-5">
                  <button
                    onClick={handleSubmit}
                    disabled={addingPackage}
                    className="px-6 py-2 bg-[#471803] text-white hover:bg-[#471803]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Register Package
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md animate-in fade-in slide-in-from-left-5">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>
      )}

      {addingPackage && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#471803]" />
        </div>
      )}

      <div className="fixed right-4 top-24 bottom-8 w-80 overflow-y-auto">
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start space-x-2 bg-[#471803]/5 border-2 border-[#471803] p-2 rounded-md animate-in fade-in slide-in-from-right-5"
            >
              <Package size={16} className="text-[#471803] mt-0.5 shrink-0" />
              <span className="flex-1 text-sm text-[#471803]">
                #{alert.packageId} - {alert.Last}, {alert.First}
              </span>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-[#471803] hover:text-[#471803]/70 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-8">
        <button
          onClick={() => setNoName(true)}
          className="border-2 border-[#471803] px-4 py-2 text-[#471803] hover:bg-[#471803]/5 transition-colors text-sm"
        >
          Report Missing Name
        </button>
      </div>

      <ReportName
        open={noName}
        handleClose={() => setNoName(false)}
      />
    </div>
  );
} 