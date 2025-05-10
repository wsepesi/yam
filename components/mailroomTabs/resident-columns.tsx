import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColumnDef } from "@tanstack/react-table"
import { Resident } from '@/lib/types'; // Assuming Resident type is defined in types

// --- Columns for Residents ---
export const residentColumns: ColumnDef<Resident>[] = [
  {
    accessorKey: "first_name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-[#471803]/10 text-[#471803]/80 hover:text-[#471803] p-1"
        >
          First Name
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="capitalize pl-3">{row.getValue("first_name")}</div>,
  },
  {
    accessorKey: "last_name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-[#471803]/10 text-[#471803]/80 hover:text-[#471803] p-1"
        >
          Last Name
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="capitalize pl-3">{row.getValue("last_name")}</div>,
  },
  {
    accessorKey: "email",
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
    cell: ({ row }) => <div className="lowercase">{row.getValue("email")}</div>,
  },
  {
    accessorKey: "student_id",
    header: "Student ID",
    cell: ({ row }) => <div>{row.getValue("student_id")}</div>,
  },
  // Add more columns as needed, e.g., created_at, added_by if they are part of the Resident type and useful for display
]; 