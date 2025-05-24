import { AlertCircle, Check, PlusCircle, Trash2, X } from 'lucide-react';
import React, { FormEvent, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Represents a state where all days are closed, no periods.
// This corresponds to mailroom_hours being NULL or non-existent in the DB.
const ALL_CLOSED_HOURS: Record<string, MailroomDayHours> = DAYS_OF_WEEK.reduce((acc, day) => {
  acc[day] = { periods: [], closed: true };
  return acc;
}, {} as Record<string, MailroomDayHours>);

interface MailroomHourPeriod {
  id: string;
  open: string;
  close: string;
}

interface MailroomDayHours {
  periods: MailroomHourPeriod[];
  closed: boolean;
}

interface EmailSettings {
  mailroomHours: Record<string, MailroomDayHours>;
  emailAdditionalText: string;
}

// Define types for the raw data coming from the API
interface RawMailroomHourPeriod {
  open: string;
  close: string;
}

interface RawMailroomDayHours {
  periods: RawMailroomHourPeriod[];
  closed: boolean;
}

interface ApiSettingsData {
  mailroom_hours?: Record<string, RawMailroomDayHours> | null;
  email_additional_text?: string | null;
  error?: string;
}

const generatePeriodId = () => `period_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

const SkeletonHourRow = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-3 py-2">
    <Skeleton className="h-8 w-1/2 md:w-3/4" />
    <div className="md:col-span-2 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
    <div className="flex items-center justify-end space-x-2 md:col-span-1">
      <Skeleton className="h-5 w-5" />
      <Skeleton className="h-6 w-16" />
    </div>
    <div className="md:col-start-2 md:col-span-3">
      <Skeleton className="h-8 w-1/3 mt-1" />
    </div>
  </div>
);

export default function ManageEmailContent() {
  const router = useRouter();
  const { session } = useAuth();
  const { org, mailroom } = router.query;

  // Default hours to display in the UI before data loads or if loading fails.
  const defaultDisplayHours = useMemo(() => {
    return DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day] = { periods: [], closed: day === 'Saturday' || day === 'Sunday' };
      return acc;
    }, {} as Record<string, MailroomDayHours>);
  }, []);

  const [settings, setSettings] = useState<EmailSettings>({
    mailroomHours: defaultDisplayHours,
    emailAdditionalText: '',
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
        const mailroomDetailsRes = await fetch(`/api/mailrooms/details?orgSlug=${org}&mailroomSlug=${mailroom}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const mailroomDetailsData = await mailroomDetailsRes.json();
        if (!mailroomDetailsRes.ok || !mailroomDetailsData.mailroomId) {
          throw new Error(mailroomDetailsData.error || 'Failed to fetch mailroom details.');
        }
        setMailroomId(mailroomDetailsData.mailroomId);

        const settingsRes = await fetch(`/api/mailroom/settings?mailroomId=${mailroomDetailsData.mailroomId}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        let settingsData: ApiSettingsData | null = null;
        const contentType = settingsRes.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            try {
                settingsData = await settingsRes.json();
            } catch (jsonError) {
                console.error('Error parsing settings JSON:', jsonError);
                if (settingsRes.ok) {
                  setError('Received invalid format for settings data.');
                } else {
                  setError( `Failed to load settings (status ${settingsRes.status}).`);
                }
                setIsLoading(false);
                return;
            }
        } else if (settingsRes.ok && settingsRes.status !== 204) { // OK response but not JSON and not 204 No Content
            console.warn('Received non-JSON response for settings, body:', await settingsRes.text());
            setError('Received unexpected data format for settings.');
            setIsLoading(false);
            return;
        }
        // If 204 No Content, settingsData remains null. apiHours/apiText become undefined, handled below.
        
        if (settingsRes.ok) { // Handles 200 OK (with JSON or empty if 204)
            const apiHours = settingsData?.mailroom_hours;
            const apiText = settingsData?.email_additional_text;

            let newHoursState: Record<string, MailroomDayHours>;

            if (apiHours && typeof apiHours === 'object' && Object.keys(apiHours).length > 0) {
                newHoursState = DAYS_OF_WEEK.reduce((acc, day) => {
                    const dayDataFromApi = apiHours[day];
                    if (dayDataFromApi) {
                        acc[day] = {
                            periods: (dayDataFromApi.periods || []).map((p: RawMailroomHourPeriod) => ({ ...p, id: generatePeriodId() })),
                            closed: dayDataFromApi.closed !== undefined 
                                    ? dayDataFromApi.closed 
                                    : !(dayDataFromApi.periods && dayDataFromApi.periods.length > 0)
                        };
                    } else {
                        // Day not present in API response, implies it's closed
                        acc[day] = { periods: [], closed: true };
                    }
                    return acc;
                }, {} as Record<string, MailroomDayHours>);
            } else {
                // apiHours is null, undefined, or an empty object - represents all closed
                newHoursState = ALL_CLOSED_HOURS;
            }

            setSettings({
                mailroomHours: newHoursState,
                emailAdditionalText: apiText || '', // Defaults to empty string if null/undefined
            });
        } else if (settingsRes.status === 404) {
            // No settings found in DB. Treat as all closed, no additional text.
            setSettings({
                mailroomHours: ALL_CLOSED_HOURS,
                emailAdditionalText: '',
            });
        } else {
            // Other non-OK responses (e.g., 500, 401, 403)
            const errorDetail = settingsData?.error || `Failed to load email settings (status ${settingsRes.status}).`;
            console.warn('Failed to fetch email settings:', errorDetail, settingsData);
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
  }, [org, mailroom, session, router.isReady, defaultDisplayHours]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleDayClosedChange = (day: string, isChecked: boolean) => {
    setSettings(prev => ({
      ...prev,
      mailroomHours: {
        ...prev.mailroomHours,
        [day]: { ...prev.mailroomHours[day], closed: isChecked, periods: isChecked ? [] : prev.mailroomHours[day]?.periods || [] }
      }
    }));
  };

  const handlePeriodChange = (day: string, periodId: string, field: 'open' | 'close', value: string) => {
    setSettings(prev => ({
        ...prev,
        mailroomHours: {
            ...prev.mailroomHours,
            [day]: {
                ...prev.mailroomHours[day],
                periods: prev.mailroomHours[day].periods.map(p => 
                    p.id === periodId ? { ...p, [field]: value } : p
                )
            }
        }
    }));
  };

  const addPeriod = (day: string) => {
    setSettings(prev => ({
        ...prev,
        mailroomHours: {
            ...prev.mailroomHours,
            [day]: {
                ...prev.mailroomHours[day],
                closed: false,
                periods: [...prev.mailroomHours[day].periods, { id: generatePeriodId(), open: '09:00', close: '17:00' }]
            }
        }
    }));
  };

  const removePeriod = (day: string, periodId: string) => {
    setSettings(prev => ({
        ...prev,
        mailroomHours: {
            ...prev.mailroomHours,
            [day]: {
                ...prev.mailroomHours[day],
                periods: prev.mailroomHours[day].periods.filter(p => p.id !== periodId)
            }
        }
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

    const hoursToSubmit = Object.fromEntries(
      Object.entries(settings.mailroomHours).map(([day, dayHours]) => [
        day,
        {
          ...dayHours,
          periods: dayHours.periods.map(({ open, close }) => ({ open, close })),
        },
      ])
    );

    try {
      const response = await fetch('/api/mailroom/update-email-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          mailroomId: mailroomId,
          mailroomHours: hoursToSubmit,
          emailAdditionalText: settings.emailAdditionalText,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings.');
      }
      setSuccess('Email settings updated successfully!');
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
        <h2 className="text-xl font-medium text-[#471803]">Manage Mailroom Email Content</h2>
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
            <div className="space-y-4 p-1">
                <div className="p-6 bg-white border border-[#471803]/20">
                    <Skeleton className="h-7 w-1/3 mb-4" />
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => <SkeletonHourRow key={i} />)}
                    </div>
                </div>
                <div className="p-6 bg-white border border-[#471803]/20">
                    <Skeleton className="h-7 w-1/2 mb-3" />
                    <Skeleton className="h-5 w-full mb-3" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <div className="flex justify-end pt-2">
                    <Skeleton className="h-10 w-36" />
                </div>
            </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-1">
            <div className="p-6 bg-white border border-[#471803]/20">
              <h3 className="text-lg font-medium text-[#471803] mb-4">Mailroom Hours</h3>
              <div className="space-y-4">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="border-t border-gray-200 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-x-3 gap-y-2 mb-2">
                        <Label className="text-[#471803]/90 font-semibold col-span-1 md:col-span-1">{day}</Label>
                        <div className="col-span-1 md:col-span-3 flex items-center justify-end space-x-2">
                            <Input
                                type="checkbox"
                                id={`${day}-closed`}
                                checked={settings.mailroomHours[day]?.closed || false}
                                onChange={(e) => handleDayClosedChange(day, e.target.checked)}
                                className="h-4 w-4 text-[#471803] focus:ring-[#471803] border-[#471803]/50 rounded"
                                disabled={isSubmitting}
                            />
                            <Label htmlFor={`${day}-closed`} className="text-sm text-gray-600">Closed</Label>
                        </div>
                    </div>

                    {!settings.mailroomHours[day]?.closed && (
                        <div className="space-y-2 pl-0 md:pl-4">
                            {settings.mailroomHours[day]?.periods.map((period) => (
                            <div key={period.id} className="flex items-center gap-2">
                                <Input
                                    type="time"
                                    value={period.open}
                                    disabled={isSubmitting || settings.mailroomHours[day]?.closed}
                                    onChange={(e) => handlePeriodChange(day, period.id, 'open', e.target.value)}
                                    className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full pr-8 accent-[#471803]"
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    type="time"
                                    value={period.close}
                                    disabled={isSubmitting || settings.mailroomHours[day]?.closed}
                                    onChange={(e) => handlePeriodChange(day, period.id, 'close', e.target.value)}
                                    className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full pr-8 accent-[#471803]"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removePeriod(day, period.id)} disabled={isSubmitting || settings.mailroomHours[day]?.closed} className="text-red-500 hover:text-red-700 p-1">
                                    <Trash2 size={16}/>
                                </Button>
                            </div>
                            ))}
                            <Button type="button" variant="outline" onClick={() => addPeriod(day)} disabled={isSubmitting || settings.mailroomHours[day]?.closed} className="text-xs border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 rounded-none py-1 px-2">
                                <PlusCircle size={14} className="mr-1"/> Add Time Period
                            </Button>
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-white border border-[#471803]/20">
                <h3 className="text-lg font-medium text-[#471803] mb-1">Additional Email Text (Optional)</h3>
                <p className="text-xs text-gray-500 mb-3">This text will be inserted into the email body if provided.</p>
                <Textarea
                    id="emailAdditionalText"
                    name="emailAdditionalText"
                    value={settings.emailAdditionalText}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="e.g., Note: The mailroom will be closed for a special event next Tuesday."
                    className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
                    disabled={isSubmitting}
                />
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isSubmitting || !mailroomId || isLoading}
                className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 px-6 rounded-none"
              >
                {isSubmitting ? 'Saving Settings...' : 'Save Email Settings'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 