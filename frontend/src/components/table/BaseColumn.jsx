import React from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate, formatDateShort, formatCurrency } from "@/utils/formatting";

import { getTextContent } from "@/utils/uiHelpers";

export const TableHeader = ({ children }) => {
  return <th className="p-3 text-center text-sm font-semibold">{children}</th>;
};
export const TableCell = ({
  children,
  className = "",
  maxWidth,
  truncate = true,
}) => {
  const textContent = getTextContent(children);
  const titleText = textContent || undefined;

  return (
    <td className={`p-3 text-center text-sm ${className}`}>
      {truncate ? (
        <div
          className="truncate"
          style={maxWidth ? { maxWidth, margin: "0 auto" } : {}}
          title={titleText}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </td>
  );
};

// Standard Table Timestamp Cells.
// Date-only ("1/1/26") by default; pass `withTime` for the full date + time.
export const TimestampCells = ({ createdAt, updatedAt, withTime = false }) => {
  const format = withTime ? formatDate : formatDateShort;
  return (
    <>
      {createdAt && <TableCell>{format(createdAt)}</TableCell>}
      {updatedAt && <TableCell>{format(updatedAt)}</TableCell>}
    </>
  );
};

// Standard Table Status Cell
export const StatusCell = (props) => {
  return (
    <TableCell>
      <StatusBadge {...props} />
    </TableCell>
  );
};

// Standard Table Price Cell
export const PriceCell = ({ amount }) => {
  return (
    <TableCell className="text-success dark:text-accent font-bold">
      {formatCurrency(amount)}
    </TableCell>
  );
};

export const StockCell = ({ stock, healthyAt = 50, suffix }) => {
  const value = Number(stock) || 0;

  let className;
  let label = `${value}${suffix ? ` ${suffix}` : ""}`;

  if (value <= 0) {
    className = "text-destructive font-semibold";
    label = "Out of stock";
  } else if (value >= healthyAt) {
    className = "text-success font-semibold";
  } else {
    className = "text-amber-500 dark:text-amber-500 font-semibold";
  }

  return <TableCell className={className}>{label}</TableCell>;
};

// Actions for view, edit, delete, and export functions
export const ActionsColumn = ({
  onView,
  onEdit,
  onDelete,
  onExport,
  viewTitle = "View",
  editTitle = "Update",
  deleteTitle = "Delete",
  exportTitle = "Export",
}) => {
  return (
    <td className="p-3 text-center">
      <div className="flex items-center justify-center gap-2">
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            title="More actions"
            className="mx-auto border-none shadow-none hover:bg-transparent focus:ring-0 focus:bg-transparent"
          >
            <Ellipsis className="size-5" />
            <span className="sr-only">Open actions menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onView && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onView();
              }}
            >
              {viewTitle}
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onEdit();
              }}
            >
              {editTitle}
            </DropdownMenuItem>
          )}
          {onExport && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onExport();
              }}
            >
              {exportTitle}
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault();
                onDelete();
              }}
            >
              {deleteTitle}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </td>
  );
};
