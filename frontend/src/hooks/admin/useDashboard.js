import { useCallback, useMemo, useState } from "react";
import { useGetDashboardAnalyticsQuery } from "@/redux/api/adminApi";

// ------------------------------- Date helpers ------------------------------------

// Dates are picked as YYYY-MM-DD in the admin's own timezone. The range sent to
// the server runs from the start of `from` up to (not including) the day after
// `to`, so the "to" day is counted in full.
const pad = (n) => String(n).padStart(2, "0");

export const toDateInput = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromDateInput = (value) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const presetRange = (preset) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (preset) {
    case "today":
      return { from: start, to: start };
    case "7d":
      return { from: addDays(start, -6), to: start };
    case "this-month":
      return { from: new Date(start.getFullYear(), start.getMonth(), 1), to: start };
    case "last-month":
      return {
        from: new Date(start.getFullYear(), start.getMonth() - 1, 1),
        to: new Date(start.getFullYear(), start.getMonth(), 0),
      };
    case "this-year":
      return { from: new Date(start.getFullYear(), 0, 1), to: start };
    case "30d":
    default:
      return { from: addDays(start, -29), to: start };
  }
};

// Scopes the whole dashboard to one order type (or every type).
export const CHANNEL_OPTIONS = [
  { value: "all", label: "All" },
  { value: "dealer", label: "Dealer" },
  { value: "wholesale", label: "Wholesale" },
];

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// ------------------------------- Hook ------------------------------------

const useDashboard = () => {
  const [preset, setPreset] = useState("30d");
  const [dates, setDates] = useState(() => {
    const { from, to } = presetRange("30d");
    return { from: toDateInput(from), to: toDateInput(to) };
  });
  const [channel, setChannel] = useState("all");

  const handlePresetChange = useCallback((value) => {
    setPreset(value);
    if (value === "custom") return;
    const { from, to } = presetRange(value);
    setDates({ from: toDateInput(from), to: toDateInput(to) });
  }, []);

  // Editing either date switches to a custom range. Keep from <= to, and
  // nothing past today — there are no sales in the future.
  const handleDateChange = useCallback((field, rawValue) => {
    if (!rawValue) return;
    const today = toDateInput(new Date());
    const value = rawValue > today ? today : rawValue;
    setPreset("custom");
    setDates((prev) => {
      const next = { ...prev, [field]: value };
      if (next.from > next.to) {
        if (field === "from") next.to = value;
        else next.from = value;
      }
      return next;
    });
  }, []);

  const queryArgs = useMemo(
    () => ({
      from: fromDateInput(dates.from).toISOString(),
      to: addDays(fromDateInput(dates.to), 1).toISOString(),
      tz: TIMEZONE,
      channel,
    }),
    [dates, channel],
  );

  const { data, isLoading, isFetching, isError, refetch } =
    useGetDashboardAnalyticsQuery(queryArgs);

  return {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
    preset,
    dates,
    channel,
    setChannel,
    handlePresetChange,
    handleDateChange,
  };
};

export default useDashboard;
