import { AlertCircle, Package, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AcProps } from '@/lib/types';
import AutocompleteWithDb from '@/components/AutocompleteWithDb';
import { LogPackage } from '@/pages/api/log-package';
import { Package as PackageType } from '@/lib/types';
import { Resident } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { z } from 'zod';

interface PackageAlert extends LogPackage {
  id: string;
}

const pickupSchema = z.object({
  resident: z.object({
    First_Name: z.string(),
    Last_Name: z.string(),
    Default_Email: z.string().email(),
    University_ID: z.string()
  }),
  selectedPackages: z.array(z.string()).min(1, "Please select at least one package")
});

export default function Pickup() {
  const { session } = useAuth();
  const [resident, setResident] = useState<Resident | null>(null);
  const [packages, setPackages] = useState<PackageType[] | null>(null);
  const [alerts, setAlerts] = useState<PackageAlert[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Reset packages when resident changes
  useEffect(() => {
    if (resident === null) {
      setPackages(null);
      setCheckedItems({});
    }
  }, [resident]);

  // Clear error when form state changes
  useEffect(() => {
    if (error) setError(null);
  }, [resident, checkedItems, error]);

  const handleCheck = (packageId: string, checked: boolean) => {
    setCheckedItems(prev => ({
      ...prev,
      [packageId]: checked
    }));
  };

  const handleSearch = async () => {
    console.log('searching...')
    if (!resident) {
      setError('Please select a resident');
      return;
    }

    try {
      if (!session) {
        setError('You must be logged in to get packages');
        return;
      }
      
      setIsSearching(true);
      setError(null);
      setPackages(null);
      
      const res = await fetch('/api/get-packages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
         },
        body: JSON.stringify(resident.student_id)
      });

      if (!res.ok) throw new Error('Failed to fetch packages');

      const data = await res.json();
      const packages = data.records as PackageType[];
      
      if (packages.length === 0) {
        setError('No packages found for this resident');
        setPackages([]);
      } else {
        setPackages(packages);
        setCheckedItems(Object.fromEntries(packages.map(pkg => [pkg.packageId, false])));
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
      setError('Failed to fetch packages');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickup = async () => {
    try {
      if (!resident || !packages) {
        setError('Please select a resident and their packages');
        return;
      }

      if (!session) {
        setError('You must be logged in to pickup packages');
        return;
      }

      // Validate form data
      const selectedPackageIds = Object.entries(checkedItems)
        .filter(([, checked]) => checked)
        .map(([id]) => id);

      const validationResidentPayload = {
        First_Name: resident.first_name,
        Last_Name: resident.last_name,
        Default_Email: resident.email || '',
        University_ID: resident.student_id
      };

      const validatedData = pickupSchema.parse({
        resident: validationResidentPayload,
        selectedPackages: selectedPackageIds
      });

      setIsProcessing(true);
      setError(null);

      const selectedPackages = packages.filter(pkg => 
        validatedData.selectedPackages.includes(pkg.packageId)
      );

      for (const pkg of selectedPackages) {
        // Remove package
        const removeRes = await fetch('/api/remove-package', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
           },
          body: JSON.stringify(pkg.packageId)
        });

        if (!removeRes.ok) throw new Error('Failed to remove package');

        // Log package
        const logRes = await fetch('/api/log-package', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
           },
          body: JSON.stringify(pkg)
        });

        if (!logRes.ok) throw new Error('Failed to log package');

        const loggedPackage = await logRes.json();
        const alertId = Math.random().toString(36).substring(7);
        setAlerts(prev => [...prev, { ...loggedPackage, id: alertId }]);
      }

      // Reset form
      setResident(null);
      setPackages(null);
      setCheckedItems({});
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError('Please select at least one package');
      } else {
        console.error('Error processing pickup:', err);
        setError('An unexpected error occurred');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const acProps: AcProps<Resident> = {
    apiRoute: 'get-residents',
    acLabel: 'Resident',
    displayOption: (resident: Resident) => `${resident.last_name}, ${resident.first_name}`,
    record: resident,
    setRecord: setResident,
    setLoaded,
    headers: session ? { 'Authorization': `Bearer ${session.access_token}` } : undefined
  };

  return (
    <div className="w-full flex flex-col md:flex-row gap-6">
      <div className="w-full md:max-w-2xl">
        <h2 className="text-xl font-medium text-[#471803] mb-2">Pickup Package</h2>

        {!isProcessing && (
          <div className="space-y-8">
            <div className="flex items-start">
              <div className="flex-1">
                <AutocompleteWithDb 
                  {...acProps} 
                  actionButton={loaded ? (
                    <button
                      onClick={handleSearch}
                      className="px-3 bg-[#471803] text-white hover:bg-[#471803]/90 transition-colors border-l-2 border-[#471803] disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!resident || isSearching}
                      aria-label="Search Packages"
                    >
                      {isSearching ? (
                        <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>
                      ) : (
                        <Search size={16} />
                      )}
                    </button>
                  ) : null}
                />
              </div>
            </div>

            {isSearching && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#471803]" />
              </div>
            )}

            {packages && packages.length > 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-5">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-[#471803]">
                    Select Packages to Pick Up
                  </label>
                  {packages.map((pkg) => (
                    <div key={pkg.packageId} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={pkg.packageId}
                        checked={checkedItems[pkg.packageId] || false}
                        onChange={(e) => handleCheck(pkg.packageId, e.target.checked)}
                        className="h-4 w-4 rounded border-[#471803] text-[#471803] focus:ring-[#471803]"
                      />
                      <label htmlFor={pkg.packageId} className="text-sm text-[#471803]">
                        Package #{pkg.packageId} - {pkg.provider}
                      </label>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handlePickup}
                  disabled={isProcessing || Object.values(checkedItems).every(v => !v)}
                  className="px-6 py-2 bg-[#471803] text-white hover:bg-[#471803]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pick Up Selected Packages
                </button>
              </div>
            )}

            {packages && packages.length === 0 && !isSearching && (
              <div className="flex items-center space-x-2 text-[#471803] bg-[#471803]/5 p-3 rounded-md animate-in fade-in slide-in-from-left-5">
                <Package size={16} />
                <span className="text-sm">No packages found for this resident</span>
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

        {isProcessing && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#471803]" />
          </div>
        )}
      </div>

      {/* Alerts section */}
      <div className="w-full md:w-80 md:sticky md:top-6 md:self-start h-auto max-h-[calc(100vh-8rem)] overflow-y-auto">
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
    </div>
  );
}