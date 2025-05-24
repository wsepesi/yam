import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Resident } from "@/lib/types"; // Assuming Resident type is defined in types

// Handler type for resident actions
export type ResidentActionHandlers = {
  onRemove: (resident: Resident) => void;
};

// --- Columns for Residents ---
export const residentColumns = (
  actionHandlers?: ResidentActionHandlers
): ColumnDef<Resident>[] => [
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
      );
    },
    cell: ({ row }) => (
      <div className="capitalize pl-3">{row.getValue("first_name")}</div>
    ),
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
      );
    },
    cell: ({ row }) => (
      <div className="capitalize pl-3">{row.getValue("last_name")}</div>
    ),
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
      );
    },
    cell: ({ row }) => <div className="lowercase">{row.getValue("email")}</div>,
  },
  {
    accessorKey: "student_id",
    header: "Student ID",
    cell: ({ row }) => <div>{row.getValue("student_id")}</div>,
  },
  // Add actions column
  {
    id: "actions",
    cell: ({ row }) => {
      const resident = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-white border-[#471803]/20 rounded-none"
          >
            <DropdownMenuItem
              className="text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-700 rounded-none"
              onClick={() => actionHandlers?.onRemove(resident)}
            >
              <Trash className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
