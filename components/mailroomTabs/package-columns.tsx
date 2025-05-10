import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
// import { Checkbox } from "@/components/ui/checkbox"
// import { CheckedState } from "@radix-ui/react-checkbox"
import { ColumnDef } from "@tanstack/react-table"
// import { ArrowUpDown, MoreHorizontal } from "lucide-react"
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu"


// Re-defining types here for standalone column definition, or import from ManagePackages.tsx if structure allows
// For simplicity in this file, defining locally.
export interface PackageCommon {
  id: string;
  residentName: string;
  residentEmail: string;
  residentStudentId: string; 
  provider: string;
  createdAt: string;
  packageId?: string;
}

export type PackageInfo = PackageCommon;
export interface RetrievedPackageInfo extends PackageCommon {
  retrievedTimestamp: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString(); // Or a more specific format
};

// --- Columns for Current Packages ---
export const currentPackagesColumns: ColumnDef<PackageInfo>[] = [
  // {
  //   id: "select",
  //   header: ({ table }) => (
  //     <Checkbox
  //       checked=
  //         {table.getIsAllPageRowsSelected() ||
  //         (table.getIsSomePageRowsSelected() && "indeterminate")}
  //       onCheckedChange={(value: CheckedState) => table.toggleAllPageRowsSelected(!!value)}
  //       aria-label="Select all"
  //       className="border-[#471803]/50 data-[state=checked]:bg-[#471803] data-[state=checked]:text-white"
  //     />
  //   ),
  //   cell: ({ row }) => (
  //     <Checkbox
  //       checked={row.getIsSelected()}
  //       onCheckedChange={(value: CheckedState) => row.toggleSelected(!!value)}
  //       aria-label="Select row"
  //       className="border-[#471803]/50 data-[state=checked]:bg-[#471803] data-[state=checked]:text-white"
  //     />
  //   ),
  //   enableSorting: false,
  //   enableHiding: false,
  // },
  {
    accessorKey: "residentName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-[#471803]/10 text-[#471803]/80 hover:text-[#471803] p-1"
        >
          Name
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="capitalize pl-3">{row.getValue("residentName")}</div>,
  },
  {
    accessorKey: "residentEmail",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-[#471803]/10 text-[#471803]/80 hover:text-[#471803] p-1"
        >
          Email
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="lowercase">{row.getValue("residentEmail")}</div>,
  },
  {
    accessorKey: "residentStudentId",
    header: "Resident ID",
    cell: ({ row }) => <div>{row.getValue("residentStudentId")}</div>,
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => <div>{row.getValue("provider")}</div>,
  },
  {
    accessorKey: "createdAt",
    header: "Logged Timestamp",
    cell: ({ row }) => <div>{formatDate(row.getValue("createdAt"))}</div>,
  },
  {
    accessorKey: "packageId",
    header: "Package ID",
    cell: ({ row }) => <div className="truncate max-w-xs">{row.getValue("packageId")}</div>,
  },
  // Add actions column if needed, similar to the example
//   {
//     id: "actions",
//     cell: ({ row }) => {
//       const pkg = row.original;
//       return (
//         <DropdownMenu>
//           <DropdownMenuTrigger asChild>
//             <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-[#471803]/10 text-[#471803]/80 hover:text-[#471803]">
//               <span className="sr-only">Open menu</span>
//               <MoreHorizontal className="h-4 w-4" />
//             </Button>
//           </DropdownMenuTrigger>
//           <DropdownMenuContent align="end" className="bg-white border-[#471803]/20">
//             <DropdownMenuLabel className="text-[#471803]">Actions</DropdownMenuLabel>
//             <DropdownMenuItem 
//               onClick={() => navigator.clipboard.writeText(pkg.id)}
//               className="hover:bg-[#471803]/10 focus:bg-[#471803]/10 text-[#471803]/90"
//             >
//               Copy Package ID
//             </DropdownMenuItem>
//             <DropdownMenuSeparator className="bg-[#471803]/20"/>
//             {/* Add other actions like 'Mark as Retrieved' or 'View Details' here */}
//             <DropdownMenuItem className="hover:bg-[#471803]/10 focus:bg-[#471803]/10 text-[#471803]/90">View Details (TBD)</DropdownMenuItem>
//           </DropdownMenuContent>
//         </DropdownMenu>
//       )
//     },
//     enableHiding: false,
//   },
];

// --- Columns for Retrieved Packages ---
export const retrievedPackagesColumns: ColumnDef<RetrievedPackageInfo>[] = [
  // Select column can be omitted if not needed for retrieved packages
  // {
  //   id: "select",
  //   header: ({ table }) => (
  //     <Checkbox
  //       checked=
  //         {table.getIsAllPageRowsSelected() ||
  //         (table.getIsSomePageRowsSelected() && "indeterminate")}
  //       onCheckedChange={(value: CheckedState) => table.toggleAllPageRowsSelected(!!value)}
  //       aria-label="Select all"
  //       className="border-[#471803]/50 data-[state=checked]:bg-[#471803] data-[state=checked]:text-white"
  //     />
  //   ),
  //   cell: ({ row }) => (
  //     <Checkbox
  //       checked={row.getIsSelected()}
  //       onCheckedChange={(value: CheckedState) => row.toggleSelected(!!value)}
  //       aria-label="Select row"
  //       className="border-[#471803]/50 data-[state=checked]:bg-[#471803] data-[state=checked]:text-white"
  //     />
  //   ),
  //   enableSorting: false,
  //   enableHiding: false,
  // },
  {
    accessorKey: "residentName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-[#471803]/10 text-[#471803]/80 hover:text-[#471803] p-1"
      >
        Name
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <div className="capitalize pl-3">{row.getValue("residentName")}</div>,
  },
  {
    accessorKey: "residentEmail",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-[#471803]/10 text-[#471803]/80 hover:text-[#471803] p-1"
      >
        Email
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <div className="lowercase">{row.getValue("residentEmail")}</div>,
  },
  {
    accessorKey: "residentStudentId",
    header: "Resident ID",
    cell: ({ row }) => <div>{row.getValue("residentStudentId")}</div>,
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => <div>{row.getValue("provider")}</div>,
  },
  {
    accessorKey: "createdAt",
    header: "Logged Time",
    cell: ({ row }) => <div>{formatDate(row.getValue("createdAt"))}</div>,
  },
  {
    accessorKey: "retrievedTimestamp",
    header: "Retrieved Timestamp",
    cell: ({ row }) => <div>{formatDate(row.getValue("retrievedTimestamp"))}</div>,
  },
  {
    accessorKey: "packageId",
    header: "Package ID",
    cell: ({ row }) => <div className="truncate max-w-xs">{row.getValue("packageId")}</div>,
  },
//   {
//     id: "actions",
//     cell: ({ row }) => {
//       const pkg = row.original;
//       return (
//         <DropdownMenu>
//           <DropdownMenuTrigger asChild>
//             <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-[#471803]/10 text-[#471803]/80 hover:text-[#471803]">
//               <span className="sr-only">Open menu</span>
//               <MoreHorizontal className="h-4 w-4" />
//             </Button>
//           </DropdownMenuTrigger>
//           <DropdownMenuContent align="end" className="bg-white border-[#471803]/20">
//             <DropdownMenuLabel className="text-[#471803]">Actions</DropdownMenuLabel>
//             <DropdownMenuItem 
//               onClick={() => navigator.clipboard.writeText(pkg.id)}
//               className="hover:bg-[#471803]/10 focus:bg-[#471803]/10 text-[#471803]/90"
//             >
//               Copy Package ID
//             </DropdownMenuItem>
//             <DropdownMenuSeparator className="bg-[#471803]/20"/>
//             <DropdownMenuItem className="hover:bg-[#471803]/10 focus:bg-[#471803]/10 text-[#471803]/90">View Details (TBD)</DropdownMenuItem>
//           </DropdownMenuContent>
//         </DropdownMenu>
//       )
//     },
//     enableHiding: false,
//   },
]; 