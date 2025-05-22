import { AlertCircle, ChevronDown, Search, X } from 'lucide-react';
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
import { PackageInfo, RetrievedPackageInfo, currentPackagesColumns, retrievedPackagesColumns } from './package-columns';
import React, { useEffect, useState } from 'react';
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
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

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

export default function ManagePackages() {
  const router = useRouter();
  const { session } = useAuth();
  const { org, mailroom } = router.query;

  const [currentPackages, setCurrentPackages] = useState<PackageInfo[]>([]);
  const [retrievedPackages, setRetrievedPackages] = useState<RetrievedPackageInfo[]>([]);
  const [totalRetrievedPackages, setTotalRetrievedPackages] = useState(0);
  
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const [isLoadingRetrieved, setIsLoadingRetrieved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [mailroomId, setMailroomId] = useState<string | null>(null);

  const [currentSorting, setCurrentSorting] = useState<SortingState>([]);
  const [currentColumnFilters, setCurrentColumnFilters] = useState<ColumnFiltersState>([]);
  const [currentColumnVisibility, setCurrentColumnVisibility] = useState<VisibilityState>({});

  const [retrievedSorting, setRetrievedSorting] = useState<SortingState>([]);
  const [retrievedColumnFilters, setRetrievedColumnFilters] = useState<ColumnFiltersState>([]);
  const [retrievedColumnVisibility, setRetrievedColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    const fetchMailroomDetails = async () => {
      if (!org || !mailroom || !session) return;
      setIsLoadingCurrent(true);
      setIsLoadingRetrieved(true);
      try {
        const response = await fetch(`/api/mailrooms/details?orgSlug=${org}&mailroomSlug=${mailroom}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch mailroom details');
        setMailroomId(data.mailroomId);
      } catch (err) {
        console.error('Error fetching mailroom details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load mailroom details.');
      }
    };
    if (router.isReady) fetchMailroomDetails();
  }, [org, mailroom, session, router.isReady]);

  useEffect(() => {
    if (mailroomId && session) {
      fetchCurrentPackages();
      fetchRetrievedPackages(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailroomId, session]);

  const fetchCurrentPackages = async () => {
    if (!mailroomId || !session) return;
    setIsLoadingCurrent(true);
    setError(null);
    try {
      const response = await fetch(`/api/packages/get-current?mailroomId=${mailroomId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch current packages');
      setCurrentPackages(data.packages || []);
    } catch (err) {
      console.error('Error fetching current packages:', err);
      setError(err instanceof Error ? err.message : 'Could not load current packages.');
      setCurrentPackages([]);
    } finally {
      setIsLoadingCurrent(false);
    }
  };

  const fetchRetrievedPackages = async (initialLoad = false) => {
    if (!mailroomId || !session) return;
    setIsLoadingRetrieved(true);
    const limit = 50;
    const offset = initialLoad ? 0 : retrievedPackages.length;
    try {
      const response = await fetch(`/api/packages/get-retrieved?mailroomId=${mailroomId}&limit=${limit}&offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch retrieved packages');
      if (initialLoad) {
        setRetrievedPackages(data.packages || []);
      } else {
        setRetrievedPackages(prev => [...prev, ...(data.packages || [])]);
      }
      setTotalRetrievedPackages(data.totalCount || 0);
    } catch (err) {
      console.error('Error fetching retrieved packages:', err);
      if (initialLoad) setRetrievedPackages([]);
    } finally {
      setIsLoadingRetrieved(false);
    }
  };

  const currentTable = useReactTable({
    data: currentPackages,
    columns: currentPackagesColumns,
    onSortingChange: setCurrentSorting,
    onColumnFiltersChange: setCurrentColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setCurrentColumnVisibility,
    state: {
      sorting: currentSorting,
      columnFilters: currentColumnFilters,
      columnVisibility: currentColumnVisibility,
    },
  });

  const retrievedTable = useReactTable({
    data: retrievedPackages,
    columns: retrievedPackagesColumns,
    onSortingChange: setRetrievedSorting,
    onColumnFiltersChange: setRetrievedColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(), 
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setRetrievedColumnVisibility,
    manualPagination: true, 
    pageCount: Math.ceil(totalRetrievedPackages / 50), 
    state: {
      sorting: retrievedSorting,
      columnFilters: retrievedColumnFilters,
      columnVisibility: retrievedColumnVisibility,
    },
  });

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-medium text-[#471803] mb-4">Manage Packages</h2>
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[60vh]">
        {error && (
          <div className="flex items-center space-x-2 p-2 bg-red-100 border border-red-400 text-red-700 text-xs rounded-none">
            <AlertCircle size={16} /><span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-0.5 hover:bg-red-200 rounded-none"><X size={14} /></button>
          </div>
        )}
        <div className="bg-white border border-[#471803]/20 rounded-none shadow-sm">
          <div className="flex justify-between items-center my-2 px-4 py-2">
            <h3 className="text-md font-medium text-[#471803]">Packages in Mailroom</h3>
            <div className="flex items-center gap-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                <Input 
                  placeholder="Search name..." 
                  value={(currentTable.getColumn('residentName')?.getFilterValue() as string) ?? ''} 
                  onChange={(event) => currentTable.getColumn('residentName')?.setFilterValue(event.target.value)}
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
                  {currentTable.getAllColumns().filter((column) => column.getCanHide()).map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id} className="capitalize text-xs text-[#471803]/90 hover:bg-[#471803]/10 focus:bg-[#471803]/10 px-6 py-1 rounded-none"
                      checked={column.getIsVisible()} onCheckedChange={(value: boolean) => column.toggleVisibility(!!value)}>
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {isLoadingCurrent && (
            <Table><TableBody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} numberOfCells={currentPackagesColumns.length} />)}</TableBody></Table>
          )}
          {!isLoadingCurrent && !error && currentPackages.length === 0 && <p className="text-[#471803]/70 italic text-sm px-4 py-2">No current packages found.</p>}
          {!isLoadingCurrent && !error && currentPackages.length > 0 && (
            <div className="rounded-none border-t border-[#471803]/20">
              <Table>
                <TableHeader className="bg-white sticky top-0">
                  {currentTable.getHeaderGroups().map((headerGroup) => (
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
                  {currentTable.getRowModel().rows?.length ? (
                    currentTable.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-[#471803]/5">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="text-xs text-[#471803] py-2 px-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={currentPackagesColumns.length} className="h-20 text-center text-[#471803]/70 text-sm">No results.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
           <div className="flex items-center justify-end space-x-1 py-2 px-4">
            <div className="flex-1 text-xs text-[#471803]/70"></div>
            {currentTable.getCanPreviousPage() && (
              <Button variant="outline" size="sm" onClick={() => currentTable.previousPage()} className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-2 py-0.5 text-xs h-auto rounded-none">Previous</Button>
            )}
            {currentTable.getCanNextPage() && (
              <Button variant="outline" size="sm" onClick={() => currentTable.nextPage()} className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-2 py-0.5 text-xs h-auto rounded-none">Next</Button>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#471803]/20 rounded-none shadow-sm">
           <div className="flex justify-between items-center m-2 px-4 py-2">
            <h3 className="text-md font-medium text-[#471803]">Retrieved Package History</h3>
            <div className="flex items-center gap-1">
              <div className="relative">
                 <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                <Input 
                  placeholder="Search name..." 
                  value={(retrievedTable.getColumn('residentName')?.getFilterValue() as string) ?? ''} 
                  onChange={(event) => retrievedTable.getColumn('residentName')?.setFilterValue(event.target.value)}
                  className="pl-6 pr-2 py-1 text-xs h-auto bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-48"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="ml-1 border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-2 py-1 text-xs h-auto rounded-none">
                    Columns <ChevronDown className="ml-1 h-5 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-[#471803]/20 rounded-none">
                  {retrievedTable.getAllColumns().filter((column) => column.getCanHide()).map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id} className="capitalize text-xs text-[#471803]/90 hover:bg-[#471803]/10 focus:bg-[#471803]/10 px-6 py-1 rounded-none"
                      checked={column.getIsVisible()} onCheckedChange={(value: boolean) => column.toggleVisibility(!!value)}>
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {(isLoadingRetrieved && retrievedPackages.length === 0) && (
            <Table><TableBody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} numberOfCells={retrievedPackagesColumns.length} />)}</TableBody></Table>
          )}
          {!isLoadingRetrieved && !error && retrievedPackages.length === 0 && <p className="text-[#471803]/70 italic text-sm px-4 py-2">No retrieved package history.</p>}
          {(retrievedPackages.length > 0 || (isLoadingRetrieved && retrievedPackages.length > 0)) && !error && (
            <div className="rounded-none border-t border-[#471803]/20">
              <Table>
                <TableHeader className="bg-white sticky top-0">
                  {retrievedTable.getHeaderGroups().map((headerGroup) => (
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
                  {retrievedTable.getRowModel().rows?.length ? (
                    retrievedTable.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-[#471803]/5">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="text-xs text-[#471803] py-2 px-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    !isLoadingRetrieved && <TableRow><TableCell colSpan={retrievedPackagesColumns.length} className="h-20 text-center text-[#471803]/70 text-sm">No results.</TableCell></TableRow>
                  )}
                  {isLoadingRetrieved && retrievedPackages.length > 0 && (
                      <TableRow><TableCell colSpan={retrievedPackagesColumns.length} className="h-10 text-center text-[#471803]/70 italic text-sm py-2">Loading more...</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-between py-2 px-4">
              <div className="flex-1 text-xs text-[#471803]/70"></div>
              {retrievedPackages.length < totalRetrievedPackages && !isLoadingRetrieved && (
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchRetrievedPackages(false)} 
                      disabled={isLoadingRetrieved}
                      className="border-[#471803]/50 text-[#471803] hover:bg-[#471803]/10 px-2 py-0.5 text-xs h-auto rounded-none"
                  >
                      Load More
                  </Button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
} 