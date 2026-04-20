import React from "react";
import SearchBar from "@/components/table/SearchBar";
import ShowEntries from "@/components/table/ShowEntries";
import Pagination from "@/components/table/Pagination";
import { TableHeader } from "@/components/table/BaseColumn";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

const TableLayout = ({
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  entriesValue,
  onEntriesChange,
  page,
  onPageChange,
  totalItems,
  totalPages,
  columns = [],
  data = [],
  renderRow,
  isLoading = false,
  startItem = 0,
  endItem = 0,
  onPrevious,
  onNext,
  searchExtra,
}) => {
  return (
    <div className="space-y-5 pt-5">
      <div className="flex items-center justify-between">
        {/* Show entries */}
        <ShowEntries value={entriesValue} onValueChange={onEntriesChange} />
        {/* Search bar + extra controls */}
        <div className="flex items-center gap-2">
          {searchExtra}
          <SearchBar
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchChange}
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full">
          <thead className="bg-input dark:bg-card/30">
            <tr>
              {columns.map((column) => (
                <TableHeader key={column.key}>{column.label}</TableHeader>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-10">
                  <LoadingSpinner minHeight="min-h-[10vh]" />
                </td>
              </tr>
            ) : data.length > 0 ? (
              data.map((item) => (
                <tr key={item._id || item.id} className="border-t text-sm">
                  {renderRow(item)}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-5 text-center text-muted-foreground/80"
                >
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination - Show N of N to N entries and Previous and Next Button */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        startItem={startItem}
        endItem={endItem}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </div>
  );
};

export default TableLayout;
