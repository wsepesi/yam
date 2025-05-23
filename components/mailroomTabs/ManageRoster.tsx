import * as XLSX from 'xlsx'; // Added import for xlsx

import { AlertCircle, ChevronDown, Download, Plus, Search, Upload, X } from 'lucide-react';
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ResidentActionHandlers, residentColumns } from './resident-columns'; // Import resident columns
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AddResidentDialog } from './AddResidentDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MailroomTabProps } from '@/lib/types/MailroomTabProps'; // Import the new props type
import { Resident } from '@/lib/types'; // Import Resident type
import { toast } from "sonner"
import { useAuth } from '@/context/AuthContext';

// Define a type for the parsed data from the uploaded file
interface ParsedResidentData {
  first_name?: string;
  last_name?: string;
  resident_id?: string;
  email?: string;
  [key: string]: string | number | boolean | undefined | null; // More specific than any
}

// Skeleton component for table rows
const SkeletonRow = ({ numberOfCells }: { numberOfCells: number }) => (
  <TableRow className="animate-pulse">
    {Array.from({ length: numberOfCells }).map((_, index) => (
      <TableCell key={index} className="py-3 px-2">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
      </TableCell>
    ))}
  </TableRow>
);

export default function ManageRoster({ orgSlug, mailroomSlug }: MailroomTabProps) {
  const { session } = useAuth();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // New state for file upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedResidentData[]>([]); // Use the defined type
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); // Or handle inline
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for add resident dialog
  const [isAddResidentDialogOpen, setIsAddResidentDialogOpen] = useState(false);
  
  // State for remove resident confirmation
  const [residentToRemove, setResidentToRemove] = useState<Resident | null>(null);
  const [isRemovingResident, setIsRemovingResident] = useState(false);
  
  // State for upload warning modal
  const [isUploadWarningModalOpen, setIsUploadWarningModalOpen] = useState(false);
  
  // State for upload progress
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStepMessage, setUploadStepMessage] = useState('');
  const [filledDots, setFilledDots] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const totalDots = 3;

  const loadResidents = useCallback(async () => {
    if (!session) {
      // User might not be logged in yet, or session is loading.
      // We can set residents to empty and not loading, or handle as appropriate.
      setResidents([]);
      setIsLoading(false); // Stop loading if no session
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/get-residents?orgSlug=${encodeURIComponent(orgSlug!)}&mailroomSlug=${encodeURIComponent(mailroomSlug!)}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch residents');
      setResidents(data.records || []);
    } catch (err) {
      console.error('Error fetching residents:', err);
      setError(err instanceof Error ? err.message : 'Could not load residents.');
      setResidents([]);
    } finally {
      setIsLoading(false);
    }
  }, [session, orgSlug, mailroomSlug]);

  useEffect(() => {
    loadResidents();
  }, [loadResidents]);
  
  // Progress-based dot filling
  useEffect(() => {
    if (uploadProgress === 0) {
      setFilledDots(0);
    } else if (uploadProgress < 100) {
      setFilledDots(1); // In progress
    } else {
      setFilledDots(totalDots); // Complete
    }
  }, [uploadProgress, totalDots]);

  // Time-based "walking" animation during waiting periods
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isUploading && filledDots < totalDots) {
      let currentWalkingDot = filledDots;
      
      interval = setInterval(() => {
        currentWalkingDot = (currentWalkingDot >= filledDots && currentWalkingDot < totalDots - 1) 
          ? currentWalkingDot + 1 
          : filledDots;
          
        setFilledDots(prev => {
          if (prev > currentWalkingDot) return prev;
          return currentWalkingDot;
        });
      }, 300);
    }
    
    return () => clearInterval(interval);
  }, [isUploading, filledDots, totalDots]);

  const getDotDisplay = () => {
    const emptyDot = '·';
    const filledDot = '●';
    
    const dotsArray = Array(totalDots).fill(emptyDot);
    
    for (let i = 0; i < filledDots; i++) {
      dotsArray[i] = filledDot;
    }
    
    return dotsArray.join(' ');
  };

  // Actions for resident table
  const residentActions: ResidentActionHandlers = {
    onRemove: (resident) => {
      setResidentToRemove(resident);
    }
  };

  const table = useReactTable({
    data: residents,
    columns: residentColumns(residentActions),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 6,
      },
    },
  });

  const handleUploadRosterButtonClick = () => {
    setIsUploadWarningModalOpen(true);
  };
  
  const handleConfirmUploadWarning = () => {
    setIsUploadWarningModalOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; 
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileError(null);
      setParsedData([]);

      if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => { // Type the event
          try {
            const data = e.target?.result;
            if (!data) {
              setFileError("Failed to read file.");
              return;
            }
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            // XLSX.utils.sheet_to_json returns an array of objects or an array of arrays based on `header` option.
            // With header: 1, it's an array of arrays.
            const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

            if (jsonDataRaw.length === 0) {
              setFileError("File is empty.");
              return;
            }

            const headersFromFile = jsonDataRaw[0] as string[];
            const expectedHeaders = ['first_name', 'last_name', 'resident_id', 'email'];
            
            const normalizedHeadersFromFile = headersFromFile.map(h => String(h).toLowerCase().replace(/\s+/g, '_'));
            const normalizedExpectedHeaders = expectedHeaders.map(h => h.toLowerCase().replace(/\s+/g, '_'));

            const missingHeaders = normalizedExpectedHeaders.filter(expectedHeader => !normalizedHeadersFromFile.includes(expectedHeader));
            if (missingHeaders.length > 0) {
                setFileError(`Missing required headers: ${missingHeaders.join(', ')}. Expected: ${expectedHeaders.join(', ')}. These should be the first 4 columns of the file.`);
                return;
            }
            
            const dataRows: ParsedResidentData[] = jsonDataRaw.slice(1).map((rowArray: unknown[]) => {
              const row: ParsedResidentData = {};
              normalizedHeadersFromFile.forEach((header, index) => {
                // Find the corresponding expected header to use as the key
                const originalHeaderIndex = normalizedExpectedHeaders.indexOf(header);
                const key = originalHeaderIndex !== -1 ? expectedHeaders[originalHeaderIndex] : header;
                row[key] = rowArray[index] as string; // Assuming all cell values can be treated as string for now
              });
              return row;
            }).filter(row => 
                row.first_name || row.last_name || row.resident_id || row.email
            );

            if (dataRows.length === 0) {
                setFileError("No data rows found in the file after headers.");
                return;
            }

            // Validate resident_id lengths
            let firstResidentIdLength: number | null = null;
            for (const row of dataRows) {
              const residentId = row.resident_id ? String(row.resident_id) : '';
              if (residentId) { // Only check if resident_id is present
                if (firstResidentIdLength === null) {
                  firstResidentIdLength = residentId.length;
                } else if (residentId.length !== firstResidentIdLength) {
                  setFileError("Resident IDs have inconsistent lengths. This might indicate that leading zeros were dropped during export. Please ensure all Resident IDs are formatted as text and have the same number of digits.");
                  return;
                }
              }
            }

            setParsedData(dataRows);
            setIsUploadModalOpen(true);
            console.log("Parsed data:", dataRows);
          } catch (err) {
            console.error("Error parsing file:", err);
            setFileError("Error processing file. Please ensure it's a valid CSV or XLSX.");
          }
        };
        reader.onerror = () => {
          setFileError("Failed to read file.");
        };
        reader.readAsBinaryString(file);
      } else {
        setFileError("Invalid file type. Please upload a CSV or XLSX file.");
        setSelectedFile(null);
      }
    }
  };
  
  const handleConfirmUpload = async () => {
    if (!parsedData.length || !session) {
      setFileError("No data to upload or session expired.");
      return;
    }
    
    setFileError(null); // Clear previous errors
    setUploadProgress(0);
    setUploadStepMessage('');
    setFilledDots(0);
    setIsUploading(true);

    try {
      setUploadProgress(10);
      setUploadStepMessage('Preparing roster data...');
      
      // Small delay to show initial progress
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setUploadProgress(30);
      setUploadStepMessage('Uploading roster to server...');

      const response = await fetch('/api/upload-roster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ residents: parsedData, orgSlug, mailroomSlug }), // Add slugs to body
      });

      setUploadProgress(70);
      setUploadStepMessage('Processing roster data...');

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload roster. Status: ' + response.status);
      }

      setUploadProgress(90);
      setUploadStepMessage('Finalizing...');
      
      // Small delay to show completion progress
      await new Promise(resolve => setTimeout(resolve, 300));

      // Success
      setUploadProgress(100);
      setUploadStepMessage('Roster uploaded successfully!');
      
      console.log("Upload successful:", result.message);
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setParsedData([]);
      
      // Create detailed description if counts are available
      let description = result.message;
      if (result.counts) {
        const { new: newCount, unchanged, updated, removed } = result.counts;
        const details = [];
        if (newCount > 0) details.push(`${newCount} new`);
        if (unchanged > 0) details.push(`${unchanged} unchanged`);
        if (updated > 0) details.push(`${updated} updated`);
        if (removed > 0) details.push(`${removed} removed`);
        description = `Roster processed successfully: ${details.join(', ')}.`;
      }
      
      toast.success("Roster uploaded successfully.", {
        description: description,
        style: {
          backgroundColor: '#fffaf5',
          border: '1px solid #471803',
          borderRadius: '0px',
          color: '#471803',
        },
      });
      
      await loadResidents(); // Refresh the residents list

    } catch (uploadError) {
      console.error("Error uploading roster:", uploadError);
      setFileError(uploadError instanceof Error ? uploadError.message : "Failed to upload roster.");
      setUploadStepMessage('Upload failed.');
      setUploadProgress(0);
      // Keep modal open if error occurs so user can see the error
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handler for adding a new resident
  const handleAddResidentClick = () => {
    setIsAddResidentDialogOpen(true);
  };
  
  // Handler for removing a resident
  const handleRemoveResident = async () => {
    if (!residentToRemove || !session) return;
    
    setIsRemovingResident(true);
    
    try {
      const response = await fetch('/api/remove-resident', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ residentId: residentToRemove.id }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove resident');
      }
      
      toast.success("Resident removed successfully.", {
        description: result.message,
        style: {
          backgroundColor: '#fffaf5',
          border: '1px solid #471803',
          borderRadius: '0px',
          color: '#471803',
        },
      });
      
      // Refresh the residents list
      await loadResidents();
    } catch (err) {
      console.error('Error removing resident:', err);
      toast.error("Error removing resident.", {
        description: err instanceof Error ? err.message : 'Failed to remove resident',
        style: {
          backgroundColor: '#fffaf5',
          border: '1px solid #DC2626',
          borderRadius: '0px',
          color: '#DC2626',
        },
      });
    } finally {
      setIsRemovingResident(false);
      setResidentToRemove(null);
    }
  };

  // Handler for exporting residents to CSV
  const handleExportResidents = () => {
    if (residents.length === 0) {
      toast.error("No residents to export.", {
        style: {
          backgroundColor: '#fffaf5',
          border: '1px solid #DC2626',
          borderRadius: '0px',
          color: '#DC2626',
        },
      });
      return;
    }

    try {
      // Prepare data for export
      const exportData = residents.map(resident => ({
        'First Name': resident.first_name || '',
        'Last Name': resident.last_name || '',
        'Resident ID': resident.student_id || '',
        'Email': resident.email || '',
        'Created': resident.created_at ? new Date(resident.created_at).toLocaleDateString() : '',
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Residents');

      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0];
      const filename = `residents_${orgSlug}_${mailroomSlug}_${date}.xlsx`;

      // Download the file
      XLSX.writeFile(wb, filename);

      toast.success("Residents exported successfully.", {
        description: `${residents.length} residents exported to ${filename}`,
        style: {
          backgroundColor: '#fffaf5',
          border: '1px solid #471803',
          borderRadius: '0px',
          color: '#471803',
        },
      });
    } catch (error) {
      console.error('Error exporting residents:', error);
      toast.error("Failed to export residents.", {
        style: {
          backgroundColor: '#fffaf5',
          border: '1px solid #DC2626',
          borderRadius: '0px',
          color: '#DC2626',
        },
      });
    }
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-medium text-[#471803] mb-2">Manage Roster</h2>
      
      <div className="flex justify-between items-center">
        <div>
          {/* Space for other buttons or controls if needed in the future */}
        </div>
        {/* Button and input will be moved from here */}
      </div>

      {/* Basic File Upload UI - to be replaced/enhanced with a modal */}
      {selectedFile && !isUploadModalOpen && (
        <div className="my-4 p-4 border border-gray-300 rounded-none bg-gray-50">
          <h3 className="font-medium text-sm text-[#471803]">Selected File: {selectedFile.name}</h3>
          {fileError && <p className="text-red-500 text-xs mt-1">{fileError}</p>}
          {!fileError && <p className="text-green-600 text-xs mt-1">File selected. Waiting for processing or replace by clicking &quot;Upload Roster&quot; again.</p>}
        </div>
      )}

      {/* Placeholder for Modal/Dialog to confirm upload */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-none shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-[#471803]">Confirm Roster Upload</h3>
              <button onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); setParsedData([]); setFileError(null);}} className="p-1 hover:bg-gray-200 rounded-none" disabled={isUploading}>
                <X size={20} className="text-[#471803]/70" />
              </button>
            </div>
            {fileError && (
                <div className="flex items-center space-x-2 p-2 mb-3 bg-red-100 border border-red-400 text-red-700 text-xs rounded-none">
                    <AlertCircle size={16} /><span>{fileError}</span>
                </div>
            )}
            
            {isUploading && (
              <div className="my-4">
                <div className="text-sm text-[#471803]/80 mb-1">{uploadStepMessage}</div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 border border-[#471803]/30">
                  <div
                    className="bg-[#471803] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="text-center text-lg font-mono text-[#471803]/70 mt-2 tracking-widest">
                  {getDotDisplay()}
                </div>
              </div>
            )}
            
            <p className="text-sm text-[#471803]/90 mb-2">
              Found {parsedData.length} residents in the file. Please review the first few entries below.
            </p>
            <p className="text-xs text-[#471803]/70 mb-3">
              Headers expected: first_name, last_name, resident_id, email.
            </p>
            {/* Preview Data */}
            <div className="max-h-60 overflow-y-auto border border-[#471803]/20 rounded-none mb-4">
                <Table>
                    <TableHeader className="bg-gray-50 sticky top-0">
                        <TableRow className="border-b-[#471803]/20">
                            {parsedData.length > 0 && Object.keys(parsedData[0]).map(key => (
                                <TableHead key={key} className="text-[#471803]/70 text-xs px-2 py-2">{key.replace('_', ' ')}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-white divide-y divide-[#471803]/10">
                        {parsedData.slice(0, 5).map((row: ParsedResidentData, rowIndex) => (
                            <TableRow key={rowIndex} className="hover:bg-[#471803]/5">
                                {Object.values(row).map((value: string | number | boolean | undefined | null, cellIndex) => (
                                    <TableCell key={cellIndex} className="text-xs text-[#471803] py-2 px-2">{String(value ?? '')}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {parsedData.length > 5 && <p className="text-xs text-[#471803]/70 mb-4">...and {parsedData.length - 5} more rows.</p>}
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); setParsedData([]); setFileError(null);}}
                className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-3 py-1.5 text-sm h-auto rounded-none"
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmUpload} 
                disabled={!!fileError || parsedData.length === 0 || isUploading}
                className="bg-[#471803] text-white hover:bg-[#5a2e1a] px-3 py-1.5 text-sm h-auto rounded-none disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : `Confirm & Upload ${parsedData.length > 0 ? `(${parsedData.length})` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Remove Resident Confirmation Dialog */}
      {residentToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-none shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-[#471803]">Remove Resident</h3>
              <button onClick={() => setResidentToRemove(null)} className="p-1 hover:bg-gray-200 rounded-none">
                <X size={20} className="text-[#471803]/70" />
              </button>
            </div>
            <p className="text-sm text-[#471803]/90 mb-4">
              Are you sure you want to remove {residentToRemove.first_name} {residentToRemove.last_name} ({residentToRemove.student_id}) from the roster?
            </p>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setResidentToRemove(null)}
                className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-3 py-1.5 text-sm h-auto rounded-none"
                disabled={isRemovingResident}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRemoveResident} 
                disabled={isRemovingResident}
                className="bg-red-600 text-white hover:bg-red-700 px-3 py-1.5 text-sm h-auto rounded-none disabled:opacity-50"
              >
                {isRemovingResident ? 'Removing...' : 'Remove Resident'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Upload Warning Modal */}
      {isUploadWarningModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-none shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-[#471803]">Upload Roster - Important Notice</h3>
              <button onClick={() => setIsUploadWarningModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-none">
                <X size={20} className="text-[#471803]/70" />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              {/* Warning about replacing residents */}
              <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-none">
                <AlertCircle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-800 mb-1">Replace All Residents</h4>
                  <p className="text-sm text-yellow-700">
                    Uploading a new roster will replace <strong>all</strong> of the old residents. If you want to keep existing residents, make sure they are present in the new roster, or upload new residents individually using the &quot;Add Resident&quot; button.
                  </p>
                </div>
              </div>
              
              {/* File format requirements */}
              <div className="space-y-2">
                <h4 className="font-medium text-[#471803]">Required File Format</h4>
                <div className="text-sm text-[#471803]/80 space-y-2">
                  <p><strong>File types:</strong> CSV (.csv) or Excel (.xlsx)</p>
                  <p><strong>Required columns (first 4 columns):</strong></p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li><code className="bg-gray-100 px-1 py-0.5 rounded text-xs">first_name</code> - Resident&apos;s first name</li>
                    <li><code className="bg-gray-100 px-1 py-0.5 rounded text-xs">last_name</code> - Resident&apos;s last name</li>
                    <li><code className="bg-gray-100 px-1 py-0.5 rounded text-xs">resident_id</code> - Unique resident/student ID</li>
                    <li><code className="bg-gray-100 px-1 py-0.5 rounded text-xs">email</code> - Resident&apos;s email address</li>
                  </ul>
                  <p className="text-xs text-[#471803]/60 mt-2">
                    <strong>Note:</strong> Ensure resident IDs are formatted as text to preserve leading zeros and maintain consistent length.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsUploadWarningModalOpen(false)}
                className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-3 py-1.5 text-sm h-auto rounded-none"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmUploadWarning}
                className="bg-[#471803] text-white hover:bg-[#5a2e1a] px-3 py-1.5 text-sm h-auto rounded-none"
              >
                I Understand, Continue
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Resident Dialog */}
      <AddResidentDialog 
        isOpen={isAddResidentDialogOpen}
        onClose={() => setIsAddResidentDialogOpen(false)}
        onResidentAdded={() => {
          loadResidents();
          toast.success("Resident added successfully!", {
            style: {
              backgroundColor: '#fffaf5',
              border: '1px solid #471803',
              borderRadius: '0px',
              color: '#471803',
            },
          }); 
        }}
        orgSlug={orgSlug!}
        mailroomSlug={mailroomSlug!}
      />

      <div className="flex-1 space-y-4 pr-1"> {/* Adjusted max-h for the new button section */}
        {error && (
          <div className="flex items-center space-x-2 p-2 bg-red-100 border border-red-400 text-red-700 text-xs rounded-none">
            <AlertCircle size={16} /><span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-0.5 hover:bg-red-200 rounded-none"><X size={14} /></button>
          </div>
        )}
        <div className="bg-white border border-[#471803]/20 rounded-none shadow-sm">
          <div className="flex justify-between items-center my-2 px-4 py-2">
            <h3 className="text-md font-medium text-[#471803]">Current Residents</h3>
            <div className="flex items-center gap-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                <Input 
                  placeholder="Search last name..." 
                  value={(table.getColumn('last_name')?.getFilterValue() as string) ?? ''} 
                  onChange={(event) => table.getColumn('last_name')?.setFilterValue(event.target.value)}
                  className="pl-6 pr-2 py-1.5 text-sm h-auto bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-48"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="ml-1 border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-2 py-1.5 text-sm h-auto rounded-none">
                    Columns <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-[#471803]/20 rounded-none">
                  {table.getAllColumns().filter((column) => column.getCanHide()).map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id} className="capitalize text-xs text-[#471803]/90 hover:bg-[#471803]/10 focus:bg-[#471803]/10 px-6 py-1 rounded-none"
                      checked={column.getIsVisible()} onCheckedChange={(value: boolean) => column.toggleVisibility(!!value)}>
                      {column.id.replace('_', ' ')} {/* Show column id with underscore replaced by space */}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Add Resident Button */}
              <Button 
                onClick={handleAddResidentClick}
                variant="outline"
                className="ml-1 border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-3 py-1.5 text-sm h-auto rounded-none"
              >
                <Plus size={16} className="mr-2" />
                Add Resident
              </Button>
              
              {/* Upload Roster Button */}
              <Button 
                onClick={handleUploadRosterButtonClick}
                variant="outline"
                className="ml-1 border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-3 py-1.5 text-sm h-auto rounded-none"
              >
                <Upload size={16} className="mr-2" />
                Upload Roster
              </Button>
              
              {/* Export Residents Button */}
              <Button 
                onClick={handleExportResidents}
                variant="outline"
                className="ml-1 border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-3 py-1.5 text-sm h-auto rounded-none"
              >
                <Download size={16} className="mr-2" />
                Export
              </Button>

              <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              />
            </div>
          </div>
          {isLoading && (
            <Table><TableBody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} numberOfCells={5} />)}</TableBody></Table>
          )}
          {!isLoading && !error && residents.length === 0 && <p className="text-[#471803]/70 italic text-sm px-4 py-2">No residents found.</p>}
          {!isLoading && !error && residents.length > 0 && (
            <div className="rounded-none border-t border-[#471803]/20">
              <Table>
                <TableHeader className="bg-white sticky top-0">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="border-b-[#471803]/20">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="text-[#471803]/70 text-xs px-2 py-2">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className="bg-white divide-y divide-[#471803]/10">
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-[#471803]/5">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="text-xs text-[#471803] py-2 px-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-[#471803]/70 text-sm">No results.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
           <div className="flex items-center justify-end space-x-1 py-2 px-4">
            <div className="flex-1 text-xs text-[#471803]/70">
              {/* Pagination info if needed */}
            </div>
            {table.getCanPreviousPage() && (
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-2 py-0.5 text-xs h-auto rounded-none">Previous</Button>
            )}
            {table.getCanNextPage() && (
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-2 py-0.5 text-xs h-auto rounded-none">Next</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 