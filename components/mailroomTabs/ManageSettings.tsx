import { AlertCircle, Check, X } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import React, { FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

interface PickupSettings {
  pickupOption: 'resident_id' | 'resident_name';
}

const PickupOptionsSkeleton = () => (
  <div className="space-y-4 p-1">
    <div className="p-6 bg-white border border-[#471803]/20">
      <Skeleton className="h-7 w-1/3 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <div className="space-y-2 ml-6">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
    <div className="flex justify-end pt-2">
      <Skeleton className="h-10 w-36" />
    </div>
  </div>
);

export default function ManageSettings() {
  const router = useRouter();
  const { session } = useAuth();
  const { org, mailroom } = router.query;

  const [settings, setSettings] = useState<PickupSettings>({
    pickupOption: 'resident_id',
  });
  
  const [mailroomId, setMailroomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchMailroomDetailsAndSettings = async () => {
      if (!org || !mailroom || !session) return;
      setIsLoading(true);
      setError(null);
      try {
        // First fetch mailroom details to get the ID
        const mailroomDetailsRes = await fetch(`/api/mailrooms/details?orgSlug=${org}&mailroomSlug=${mailroom}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const mailroomDetailsData = await mailroomDetailsRes.json();
        if (!mailroomDetailsRes.ok || !mailroomDetailsData.mailroomId) {
          throw new Error(mailroomDetailsData.error || 'Failed to fetch mailroom details.');
        }
        setMailroomId(mailroomDetailsData.mailroomId);

        // Then fetch mailroom settings
        const settingsRes = await fetch(`/api/mailroom/get-settings?mailroomId=${mailroomDetailsData.mailroomId}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings({
            pickupOption: settingsData.pickup_option || 'resident_id',
          });
        } else if (settingsRes.status === 404) {
          // No settings found, use defaults
          setSettings({
            pickupOption: 'resident_id',
          });
        } else {
          const errorDetail = `Failed to load settings (status ${settingsRes.status}).`;
          console.warn('Failed to fetch settings:', errorDetail);
          setError(errorDetail);
        }

      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load initial data.');
      } finally {
        setIsLoading(false);
      }
    };

    if (router.isReady) {
      fetchMailroomDetailsAndSettings();
    }
  }, [org, mailroom, session, router.isReady]);

  const handlePickupOptionChange = (value: string) => {
    setSettings(prev => ({ 
      ...prev, 
      pickupOption: value as 'resident_id' | 'resident_name' 
    }));
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mailroomId || !session) {
      setError("Mailroom ID not found or session expired.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/mailroom/update-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          mailroomId: mailroomId,
          pickupOption: settings.pickupOption,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings.');
      }
      setSuccess('Settings updated successfully!');
    } catch (err) {
      console.error('Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium text-[#471803]">Manage Mailroom Settings</h2>
        <div className="flex-grow flex justify-end space-x-2 max-w-md">
          {error && (
            <div className="flex items-center space-x-2 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-200 rounded">
                <X size={14} />
              </button>
            </div>
          )}
          {success && (
            <div className="flex items-center space-x-2 p-2 bg-green-100 border border-green-400 text-green-700 text-sm rounded">
              <Check size={16} />
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="ml-auto p-1 hover:bg-green-200 rounded">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[65vh]"> 
        {isLoading ? (
          <PickupOptionsSkeleton />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-1">
            <div className="p-6 bg-white border border-[#471803]/20">
              <h3 className="text-lg font-medium text-[#471803] mb-4">Pickup Search Option</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose how staff will search for residents when processing package pickups.
              </p>
              
              <RadioGroup 
                value={settings.pickupOption} 
                onValueChange={handlePickupOptionChange}
                disabled={isSubmitting}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value="resident_id" 
                    id="resident_id"
                    className="border-[#471803]/50 text-[#471803] focus:ring-[#471803]" 
                  />
                  <Label htmlFor="resident_id" className="text-[#471803]/90 font-medium">
                    Resident ID
                  </Label>
                </div>
               
                
                <div className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value="resident_name" 
                    id="resident_name"
                    className="border-[#471803]/50 text-[#471803] focus:ring-[#471803]" 
                  />
                  <Label htmlFor="resident_name" className="text-[#471803]/90 font-medium">
                    Resident Name
                  </Label>
                </div>
               
              </RadioGroup>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isSubmitting || !mailroomId || isLoading}
                className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 px-6 rounded-none"
              >
                {isSubmitting ? 'Saving Settings...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 