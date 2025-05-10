import * as XLSX from 'xlsx'; // Added import for xlsx

import { AlertCircle, ChevronDown, Search, Upload, X } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Resident } from '@/lib/types'; // Import Resident type
import { residentColumns } from './resident-columns'; // Import resident columns
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

export default function ManageRoster() {
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
      const response = await fetch('/api/get-residents', {
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
  }, [session]);

  useEffect(() => {
    loadResidents();
  }, [loadResidents]);

  const table = useReactTable({
    data: residents,
    columns: residentColumns,
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
  });

  const handleUploadRosterButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
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
                setFileError(`Missing required headers: ${missingHeaders.join(', ')}. Expected: ${expectedHeaders.join(', ')}`);
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

    try {
      const response = await fetch('/api/upload-roster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ residents: parsedData }), // Ensure key is 'residents'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload roster. Status: ' + response.status);
      }

      // Success
      console.log("Upload successful:", result.message);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setParsedData([]);
      
      if (typeof window !== "undefined") {
        alert(result.message + ' Roster uploaded. The list will refresh.');
      }
      await loadResidents(); // Refresh the residents list

    } catch (uploadError) {
      console.error("Error uploading roster:", uploadError);
      setFileError(uploadError instanceof Error ? uploadError.message : "Failed to upload roster.");
      // Keep modal open if error occurs so user can see the error
    }
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-medium text-[#471803] mb-4">Manage Roster</h2>
      
      <div className="flex justify-between items-center mb-4">
        <div>
          {/* Space for other buttons or controls if needed in the future */}
        </div>
        <Button 
          onClick={handleUploadRosterButtonClick}
          variant="outline"
          className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-3 py-1.5 text-sm h-auto rounded-none"
        >
          <Upload size={16} className="mr-2" />
          Upload Roster
        </Button>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        />
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
              <button onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); setParsedData([]); setFileError(null);}} className="p-1 hover:bg-gray-200 rounded-none">
                <X size={20} className="text-[#471803]/70" />
              </button>
            </div>
            {fileError && (
                <div className="flex items-center space-x-2 p-2 mb-3 bg-red-100 border border-red-400 text-red-700 text-xs rounded-none">
                    <AlertCircle size={16} /><span>{fileError}</span>
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
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmUpload} 
                disabled={!!fileError || parsedData.length === 0}
                className="bg-[#471803] text-white hover:bg-[#5a2e1a] px-3 py-1.5 text-sm h-auto rounded-none disabled:opacity-50"
              >
                Confirm & Upload {parsedData.length > 0 ? `(${parsedData.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[calc(100vh-250px)]"> {/* Adjusted max-h for the new button section */}
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
                  className="pl-6 pr-2 py-1 text-xs h-auto bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-48"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="ml-1 border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-2 py-1 text-xs h-auto rounded-none">
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
            </div>
          </div>
          {isLoading && (
            <Table><TableBody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} numberOfCells={residentColumns.length} />)}</TableBody></Table>
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
                    <TableRow><TableCell colSpan={residentColumns.length} className="h-20 text-center text-[#471803]/70 text-sm">No results.</TableCell></TableRow>
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