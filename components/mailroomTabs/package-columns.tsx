import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColumnDef } from "@tanstack/react-table"
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

export const currentPackagesColumns: ColumnDef<PackageInfo>[] = [
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
];

export const retrievedPackagesColumns: ColumnDef<RetrievedPackageInfo>[] = [
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
]; 