import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  ChartPie,
  ChevronUp,
  ClipboardList,
  CreditCard,
  Info,
  Package,
  PackageOpen,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Truck,
  Wallet,
  XCircle,
  Table2,
  LineChart,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import ColorSwatch from "@/components/shared/ColorSwatch";
import ErrorState from "@/components/shared/ErrorState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import {
  DonutChart,
  EmptyState,
  SegmentBar,
  Sparkline,
  TrendChart,
} from "@/components/admin/dashboard/charts";
import { PAYMENT_GATEWAY_LABELS, STATUS_CONFIG } from "@/constant/orderData";
import { formatCompact, formatPercent } from "@/utils/formatting";
import useDashboard, {
  CHANNEL_OPTIONS,
  DATE_PRESETS,
  toDateInput,
} from "@/hooks/admin/useDashboard";

// ------------------------------- Display config ------------------------------------

// Series colors in fixed order — an entity keeps its color whatever the filter.
const ORDER_TYPES = {
  dealer: { label: "Dealer", color: "var(--viz-1)" },
  wholesale: { label: "Wholesale", color: "var(--viz-2)" },
  product: { label: "Product", color: "var(--viz-3)" },
  reward: { label: "Reward", color: "var(--viz-other)" },
};

const GATEWAYS = {
  stripe: "var(--viz-1)",
  square: "var(--viz-2)",
};

// Status colors are reserved for state and always ship with an icon + label.
const STATUS_COLORS = {
  on_hold: "bg-amber-500",
  paid: "bg-success",
  shipped: "bg-blue-600",
  delivered: "bg-emerald-700",
  cancelled: "bg-destructive",
  failed: "bg-neutral-400",
};

// Inventory tab shows only the best sellers.
const TOP_INVENTORY = 20;

// Every amount is what the customer paid — gateway fees are never subtracted.
const FEES_NOTE =
  "Amounts are what customers paid. Stripe and Square processing fees are not deducted.";

// Parts of what customers paid, in the order money is added to an order.
const MONEY_PARTS = [
  {
    key: "subtotal",
    label: "Items",
    hint: "Products, bundles and add-ons",
    icon: Package,
    color: "bg-success",
    chip: "text-success bg-success/10 ring-success/20",
  },
  {
    key: "shipping",
    label: "Shipping",
    hint: "Charged at checkout",
    icon: Truck,
    color: "bg-viz-1",
    chip: "text-viz-1 bg-viz-1/10 ring-viz-1/20",
  },
  {
    key: "consolidated",
    label: "Consolidated shipping",
    hint: "Paid later for held orders",
    icon: Boxes,
    color: "bg-viz-2",
    chip: "text-viz-2 bg-viz-2/10 ring-viz-2/20",
  },
  {
    key: "insurance",
    label: "Shipping insurance",
    hint: "Optional parcel cover",
    icon: ShieldCheck,
    color: "bg-amber-500",
    chip: "text-amber-600 bg-amber-500/10 ring-amber-500/20",
  },
  {
    key: "tax",
    label: "Tax",
    hint: "Sales tax collected",
    icon: Receipt,
    color: "bg-viz-other",
    chip: "text-muted-foreground bg-muted ring-border",
  },
];

// Where an add-on is offered, as set on the add-on itself.
const channelLabel = (channels = []) => {
  const dealer = channels.includes("dealer");
  const wholesale = channels.includes("wholesale");
  if (dealer && wholesale) return "Dealer / Wholesale";
  if (wholesale) return "Wholesale";
  if (dealer) return "Dealer";
  return null;
};

// Who the Dealer & Wholesale section describes for each order-type filter.
const CHANNEL_BUYERS = {
  all: "dealers and wholesalers",
  dealer: "dealers",
  wholesale: "wholesalers",
};

// One line under each status so it reads without knowing the workflow.
const STATUS_HINTS = {
  on_hold: "Paid, stored until the customer ships",
  paid: "Paid and ready to pack",
  shipped: "Handed to the carrier",
  delivered: "Handed over or picked up",
  cancelled: "Cancelled before shipping",
  failed: "Payment didn't go through",
};

const STATUS_ORDER = [
  "paid",
  "on_hold",
  "shipped",
  "delivered",
  "cancelled",
  "failed",
];

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatMoney = (value) =>
  `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;
const typeLabel = (type) => ORDER_TYPES[type]?.label || type || "—";
const gatewayLabel = (gateway) => PAYMENT_GATEWAY_LABELS[gateway] || gateway;
const sumBy = (rows, key) => rows.reduce((sum, r) => sum + (r[key] || 0), 0);

// ------------------------------- Periods ------------------------------------

// Every day (or month) in the range, so quiet days read as zero, not skipped.
const buildPeriods = (from, to, bucket) => {
  const keys = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (bucket === "hour") {
    // Stop at the current hour when the day is today — later hours have no sales yet.
    const now = new Date();
    const lastHour = from === toDateInput(now) ? now.getHours() : 23;
    for (let h = 0; h <= lastHour; h += 1) {
      keys.push(`${from}T${String(h).padStart(2, "0")}`);
    }
  } else if (bucket === "month") {
    const end = new Date(ty, tm - 1, 1);
    for (
      let d = new Date(fy, fm - 1, 1);
      d <= end;
      d.setMonth(d.getMonth() + 1)
    ) {
      keys.push(toDateInput(d).slice(0, 7));
    }
  } else {
    const end = new Date(ty, tm - 1, td);
    for (
      let d = new Date(fy, fm - 1, fd);
      d <= end;
      d.setDate(d.getDate() + 1)
    ) {
      keys.push(toDateInput(d));
    }
  }
  return keys;
};

// Keys look like 2026-10-19, 2026-10, or 2026-10-19T09 for hours.
const periodDate = (key) => {
  const [datePart, hour] = key.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d || 1, Number(hour) || 0);
};

const formatPeriod = (key, bucket, long = false) => {
  const date = periodDate(key);
  if (bucket === "hour") {
    return long
      ? date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : date.toLocaleTimeString(undefined, { hour: "numeric" });
  }
  return date.toLocaleDateString(
    undefined,
    bucket === "month"
      ? { month: long ? "long" : "short", year: "numeric" }
      : long
        ? { weekday: "short", month: "short", day: "numeric", year: "numeric" }
        : { month: "short", day: "numeric" },
  );
};

// ------------------------------- Building blocks ------------------------------------

const Panel = ({ title, description, action, children, className = "" }) => (
  <section
    className={`bg-card dark:bg-card/50 rounded-xl border border-border/70 dark:border-none shadow-sm p-4 flex flex-col gap-3 min-w-0 ${className}`}
  >
    {(title || action) && (
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {action}
      </header>
    )}
    {children}
  </section>
);

// Change vs the previous period of the same length.
const Delta = ({ current, previous }) => {
  if (!previous) {
    return (
      <span className="text-xs text-muted-foreground">
        {current ? "No earlier data" : "—"}
      </span>
    );
  }
  const up = current >= previous;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
      >
        <Icon className="size-3.5" />
        {formatPercent(Math.abs(current - previous), previous)}
      </span>
      <span className="text-muted-foreground">vs previous</span>
    </span>
  );
};

const StatTile = ({
  label,
  value,
  current,
  previous,
  hint,
  trend,
  info,
  footer,
}) => (
  <section className="bg-card dark:bg-card/50 rounded-xl border border-border/70 dark:border-none shadow-sm p-4 flex flex-col gap-1.5 min-w-0">
    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {info && (
        <span title={info} aria-label={info} role="img" className="cursor-help">
          <Info className="size-3.5" />
        </span>
      )}
    </span>
    <span className="text-2xl font-bold tracking-tight truncate">{value}</span>
    {/* Same height for the badge and plain-text hints so every card lines up. */}
    <div className="flex h-6 items-center">
      {previous !== undefined ? (
        <Delta current={current} previous={previous} />
      ) : (
        hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
    {/* Nothing to draw for a single point or an all-zero range, so take no space. */}
    {trend?.length > 1 && trend.some((v) => v > 0) && (
      <Sparkline values={trend} />
    )}
    {footer && <div className="mt-auto">{footer}</div>}
  </section>
);

// Refund rates are usually a few percent, so the bar fills at 10% — a 3%
// rate reads as a third of the bar instead of a dot. The label stays exact.
const REFUND_RATE_SCALE = 10;

// Refunds as a share of gross sales — always drawable, even at 0%. Refunded
// orders are cancelled and so missing from `sales`; add them back so the rate
// is refunds ÷ everything originally sold (the usual definition).
const RefundRate = ({ refunded, sales }) => {
  const gross = sales + refunded;
  const rate = gross > 0 ? (refunded / gross) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">Refund rate</span>
        <span className="font-semibold tabular-nums">
          {formatPercent(refunded, gross)}
          <span className="font-normal text-muted-foreground"> of gross sales</span>
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="meter"
        aria-label="Refund rate"
        aria-valuenow={Number(rate.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={REFUND_RATE_SCALE}
      >
        <div
          className="h-full rounded-full bg-destructive/80 transition-[width] duration-500"
          style={{
            width: `${Math.min(rate / REFUND_RATE_SCALE, 1) * 100}%`,
            minWidth: rate > 0 ? 4 : 0,
          }}
        />
      </div>
    </div>
  );
};

const Segmented = ({ value, onChange, options, label }) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="inline-flex rounded-lg bg-muted p-1 gap-1"
  >
    {options.map((o) => {
      const Icon = o.icon;
      const selected = value === o.value;
      return (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={selected}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {Icon && <Icon className="size-3.5" />}
          {o.label}
        </button>
      );
    })}
  </div>
);

// Column split (percent of table width) shared by every ranked table. Tables
// with many value columns give the name and percentage a little less room.
const RANK_WIDTH = 5;
const columnSplit = (valueCount) =>
  valueCount > 3 ? { name: 22, percent: 15 } : { name: 30, percent: 20 };

/**
 * Sortable, searchable table. The first column is the item name; `barKey`
 * adds a share column so the top sellers stand out at a glance.
 */
const RankedTable = ({
  columns,
  rows,
  defaultSort,
  barKey,
  // Percentages are of this total when the table shows only part of the list.
  shareTotal,
  // Key of the column the Percentage column follows (defaults to the name).
  percentAfter,
  searchKeys,
  searchPlaceholder = "Search…",
  initialRows = 10,
  emptyText = "Nothing sold in this range",
}) => {
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const [sort, setSort] = React.useState({ key: defaultSort, dir: "desc" });

  const processed = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered =
      q && searchKeys
        ? rows.filter((row) =>
            searchKeys.some((k) =>
              String(row[k] ?? "")
                .toLowerCase()
                .includes(q),
            ),
          )
        : rows;
    if (!sort.key) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" || typeof bv === "number") {
        return ((av || 0) - (bv || 0)) * dir;
      }
      return (
        String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
          numeric: true,
        }) * dir
      );
    });
  }, [rows, query, searchKeys, sort]);

  const barTotal = barKey
    ? shareTotal || rows.reduce((sum, r) => sum + (r[barKey] || 0), 0) || 1
    : 1;
  const visible = showAll ? processed : processed.slice(0, initialRows);
  const colCount = columns.length + 1 + (barKey ? 1 : 0);

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );

  const [nameColumn, ...valueColumns] = columns;
  const splitAt = percentAfter
    ? valueColumns.findIndex((c) => c.key === percentAfter) + 1
    : 0;
  const beforeBar = valueColumns.slice(0, splitAt);
  const afterBar = valueColumns.slice(splitAt);
  const split = columnSplit(valueColumns.length);
  const valueWidth =
    (100 - RANK_WIDTH - split.name - (barKey ? split.percent : 0)) /
    Math.max(valueColumns.length, 1);

  const renderHeader = (c) => {
    const right = c.align === "right";
    const active = sort.key === c.key;
    const SortIcon = !active
      ? ArrowUpDown
      : sort.dir === "desc"
        ? ChevronDown
        : ChevronUp;
    return (
      <th
        key={c.key}
        scope="col"
        className={`py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap ${right ? "text-right" : "text-left"}`}
        aria-sort={
          active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
        }
      >
        {c.sortable === false ? (
          c.label
        ) : (
          // Right-aligned headers put the icon first so the label's edge lines
          // up with the numbers underneath.
          <button
            type="button"
            onClick={() => toggleSort(c.key)}
            className={`inline-flex items-center gap-1 cursor-pointer hover:text-foreground ${right ? "flex-row-reverse" : ""} ${active ? "text-foreground" : ""}`}
          >
            {c.label}
            <SortIcon className={`size-3 ${active ? "" : "opacity-40"}`} />
          </button>
        )}
      </th>
    );
  };

  const renderCell = (c, row) => {
    const right = c.align === "right";
    return (
      <td
        key={c.key}
        className={`py-3 px-3 ${right ? "text-right tabular-nums whitespace-nowrap" : "overflow-hidden"} ${c.key === barKey ? "font-semibold" : ""}`}
      >
        {c.render ? c.render(row) : (row[c.key] ?? "—")}
      </td>
    );
  };

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {searchKeys && rows.length > 5 && (
        <label className="relative max-w-sm">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
      )}
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table
          className="w-full table-fixed text-sm"
          style={{ minWidth: 340 + valueColumns.length * 100 }}
        >
          {/* Fixed split so every table reads the same: rank, name 30%,
              percentage 20%, and the value columns share the rest equally. */}
          <colgroup>
            <col style={{ width: `${RANK_WIDTH}%` }} />
            <col style={{ width: `${split.name}%` }} />
            {beforeBar.map((c) => (
              <col key={c.key} style={{ width: `${valueWidth}%` }} />
            ))}
            {barKey && <col style={{ width: `${split.percent}%` }} />}
            {afterBar.map((c) => (
              <col key={c.key} style={{ width: `${valueWidth}%` }} />
            ))}
          </colgroup>
          <thead className="bg-muted/50">
            <tr className="border-b border-border/70">
              <th
                scope="col"
                className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground"
              >
                #
              </th>
              {renderHeader(nameColumn)}
              {beforeBar.map(renderHeader)}
              {barKey && (
                <th
                  scope="col"
                  className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap"
                >
                  Percentage
                </th>
              )}
              {afterBar.map(renderHeader)}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={colCount}>
                  {query ? (
                    <EmptyState
                      icon={Search}
                      title="No matches"
                      description="Try a different search."
                    />
                  ) : (
                    <EmptyState
                      icon={PackageOpen}
                      title={emptyText}
                      description="Try a wider date range."
                    />
                  )}
                </td>
              </tr>
            ) : (
              visible.map((row, i) => {
                const share = barKey ? (row[barKey] || 0) / barTotal : 0;
                return (
                  <tr
                    key={row.id ?? row.name ?? i}
                    // Items with no sales in the range stay listed, greyed out.
                    className={`border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors ${barKey && !row[barKey] ? "opacity-55" : ""}`}
                  >
                    <td className="py-3 px-3 text-xs text-muted-foreground tabular-nums">
                      {i + 1}
                    </td>
                    <td className="py-3 px-3 truncate">
                      {nameColumn.render
                        ? nameColumn.render(row)
                        : (row[nameColumn.key] ?? "—")}
                    </td>
                    {beforeBar.map((c) => renderCell(c, row))}
                    {barKey && (
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-xs font-medium tabular-nums">
                            {formatPercent(row[barKey], barTotal)}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-success transition-[width] duration-500"
                              style={{
                                width: `${share * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    )}
                    {afterBar.map((c) => renderCell(c, row))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {processed.length > initialRows && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show less" : `Show all ${processed.length}`}
        </Button>
      )}
    </div>
  );
};

// ------------------------------- Sales trend card ------------------------------------

const METRICS = [
  { value: "sales", label: "Sales" },
  { value: "orders", label: "Orders" },
];

const VIEWS = [
  { value: "chart", label: "Chart", icon: LineChart, title: "Show chart" },
  { value: "table", label: "Table", icon: Table2, title: "Show as table" },
];

const SalesTrend = ({ periods, bucket }) => {
  const [metric, setMetric] = React.useState("sales");
  const [view, setView] = React.useState("chart");
  const isMoney = metric === "sales";
  const types = Object.keys(ORDER_TYPES).filter((t) =>
    periods.some((p) => p.byType[t]),
  );

  const points = periods.map((p) => ({
    key: p.period,
    label: formatPeriod(p.period, bucket),
    tooltipLabel: formatPeriod(p.period, bucket, true),
    value: isMoney ? p.sales : p.orders,
    raw: p,
  }));

  return (
    <Panel
      title={isMoney ? "Sales over time" : "Orders over time"}
      description={`Paid orders per ${bucket}`}
      action={
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={METRICS}
          />
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={VIEWS}
          />
        </div>
      }
    >
      {view === "chart" ? (
        <TrendChart
          points={points}
          empty={{
            icon: LineChart,
            title: isMoney
              ? "No sales in this range"
              : "No orders in this range",
            description: "Try a wider date range.",
          }}
          ariaLabel={`${isMoney ? "Sales" : "Orders"} per ${bucket}`}
          formatValue={(v) => (isMoney ? formatMoney(v) : plural(v, "order"))}
          formatAxis={(v) => formatCompact(v, { money: isMoney })}
          renderTooltip={(point) => (
            <div className="mt-2 pt-2 border-t flex flex-col gap-1">
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>{isMoney ? "Orders" : "Sales"}</span>
                <span className="tabular-nums text-foreground">
                  {isMoney
                    ? formatNumber(point.raw.orders)
                    : formatMoney(point.raw.sales)}
                </span>
              </div>
              {isMoney &&
                types.map((t) =>
                  point.raw.byType[t] ? (
                    <div
                      key={t}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span
                          className="h-0.5 w-3 rounded-full"
                          style={{ background: ORDER_TYPES[t].color }}
                        />
                        {ORDER_TYPES[t].label}
                      </span>
                      <span className="tabular-nums">
                        {formatMoney(point.raw.byType[t])}
                      </span>
                    </div>
                  ) : null,
                )}
            </div>
          )}
        />
      ) : (
        <div className="max-h-[240px] overflow-y-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 px-2 text-left font-semibold">
                  {bucket === "month"
                    ? "Month"
                    : bucket === "hour"
                      ? "Hour"
                      : "Day"}
                </th>
                <th className="py-2 px-2 text-right font-semibold">Orders</th>
                <th className="py-2 px-2 text-right font-semibold">Sales</th>
              </tr>
            </thead>
            <tbody>
              {[...periods].reverse().map((p) => (
                <tr
                  key={p.period}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-2 px-2">
                    {formatPeriod(p.period, bucket, true)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatNumber(p.orders)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatMoney(p.sales)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

// ------------------------------- Page ------------------------------------

const Dashboard = () => {
  const {
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
  } = useDashboard();

  const today = toDateInput(new Date());
  const dateInputClass =
    "h-9 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:[color-scheme:dark]";

  // Filters scope everything below them — one row, date range first.
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-40 bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label="From date"
          value={dates.from}
          max={dates.to}
          onChange={(e) => handleDateChange("from", e.target.value)}
          className={dateInputClass}
        />
        <span className="text-sm text-muted-foreground">–</span>
        <input
          type="date"
          aria-label="To date"
          value={dates.to}
          min={dates.from}
          max={today}
          onChange={(e) => handleDateChange("to", e.target.value)}
          className={dateInputClass}
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={refetch}
        disabled={isFetching}
        title="Refresh"
        aria-label="Refresh"
      >
        <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );

  let body;
  if (isLoading) {
    body = <LoadingSpinner minHeight="min-h-[60vh]" />;
  } else if (isError || !data) {
    body = (
      <ErrorState
        title="Couldn't load the dashboard"
        description="Check your connection and try refreshing."
      />
    );
  } else {
    const { kpis, breakdown, channel: ch } = data;
    const bucket = data.range.bucket;

    const byPeriod = new Map(data.salesOverTime.map((p) => [p.period, p]));
    const periods = buildPeriods(dates.from, dates.to, bucket).map(
      (key) =>
        byPeriod.get(key) || { period: key, orders: 0, sales: 0, byType: {} },
    );
    const salesTrend = periods.map((p) => p.sales);
    const ordersTrend = periods.map((p) => p.orders);
    const avgTrend = periods.map((p) => (p.orders ? p.sales / p.orders : 0));

    const standaloneTotal = sumBy(data.standaloneShipping, "amount");
    // Every main status is listed even at zero, so the card always reads the
    // same; "failed" only appears when there is one.
    const statusRows = STATUS_ORDER.map((status) => ({
      status,
      orders: data.byStatus.find((r) => r.status === status)?.orders || 0,
    }))
      .filter((r) => r.status !== "failed" || r.orders > 0)
      .map((r) => ({
        key: r.status,
        label: STATUS_CONFIG[r.status]?.label || r.status,
        value: r.orders,
        hint: STATUS_HINTS[r.status],
        color: STATUS_COLORS[r.status] || "bg-muted-foreground",
        chip:
          STATUS_CONFIG[r.status]?.iconColor ||
          "text-muted-foreground bg-muted ring-border",
        icon: STATUS_CONFIG[r.status]?.icon || XCircle,
      }));

    const statusCount = (s) =>
      data.byStatus.find((r) => r.status === s)?.orders || 0;
    const toShip = statusCount("paid");
    const held = statusCount("on_hold");

    const moneyRows = MONEY_PARTS.map((p) => ({
      ...p,
      amount:
        p.key === "consolidated" ? standaloneTotal : breakdown[p.key] || 0,
    }));
    const grossCollected = sumBy(moneyRows, "amount");
    const totalCollected = grossCollected - breakdown.discounts;

    const bagsTotal = sumBy(ch.bags, "bags");
    const bagItemsSold = ch.bags.filter((r) => r.bags > 0).length;
    const topInventory = [...ch.bags]
      .sort((a, b) => b.bags - a.bags)
      .slice(0, TOP_INVENTORY);
    const torsoTotal = sumBy(ch.torsoBags, "quantity");
    const bundleCopies = sumBy(ch.bundles, "copies");
    const addonCopies = sumBy(ch.addons, "copies");

    const tabs = [
      {
        value: "bundles",
        label: "Bundles",
        count: ch.bundles.length,
        title: "Bundles sold",
        description: "Quantity of each minifig bundle sold",
        table: (
          <RankedTable
            rows={ch.bundles}
            defaultSort="copies"
            barKey="copies"
            columns={[
              {
                key: "name",
                label: "Bundle",
                render: (r) => <span className="font-semibold">{r.name}</span>,
              },
              {
                key: "copies",
                label: "Qty",
                align: "right",
                render: (r) => formatNumber(r.copies),
              },
              {
                key: "orders",
                label: "Orders",
                align: "right",
                render: (r) => formatNumber(r.orders),
              },
              {
                key: "revenue",
                label: "Revenue",
                align: "right",
                render: (r) => formatMoney(r.revenue),
              },
            ]}
          />
        ),
      },
      {
        value: "torso",
        label: "Torso bags",
        count: ch.torsoBags.length,
        title: "Torso bags sold",
        description: "By bag number, across every bundle ordered",
        table: (
          <RankedTable
            rows={ch.torsoBags}
            defaultSort="quantity"
            barKey="quantity"
            initialRows={Infinity}
            columns={[
              {
                key: "name",
                label: "Bag number",
                render: (r) => (
                  <span className="font-semibold">{r.name || "—"}</span>
                ),
              },
              {
                key: "quantity",
                label: "Bags sold",
                align: "right",
                render: (r) => formatNumber(r.quantity),
              },
              {
                key: "orders",
                label: "Orders",
                align: "right",
                render: (r) => formatNumber(r.orders),
              },
            ]}
          />
        ),
      },
      {
        value: "addons",
        label: "Add-ons",
        count: ch.addons.length,
        title: "Add-ons sold",
        description: "Upgrade and bundle add-ons",
        table: (
          <RankedTable
            rows={ch.addons}
            defaultSort="copies"
            barKey="copies"
            percentAfter="channels"
            columns={[
              {
                key: "name",
                label: "Add-on",
                render: (r) => <span className="font-semibold">{r.name}</span>,
              },
              {
                key: "channels",
                label: "Channel",
                render: (r) => channelLabel(r.channels) || "—",
              },
              {
                key: "copies",
                label: "Qty",
                align: "right",
                render: (r) => formatNumber(r.copies),
              },
              {
                key: "orders",
                label: "Orders",
                align: "right",
                render: (r) => formatNumber(r.orders),
              },
              {
                key: "revenue",
                label: "Revenue",
                align: "right",
                render: (r) => formatMoney(r.revenue),
              },
            ]}
          />
        ),
      },
      {
        value: "bags",
        label: "Top inventory",
        count: topInventory.length,
        title: "Top selling inventory",
        description: (
          <>
            <span className="font-semibold text-viz-1 tabular-nums">
              {formatNumber(bagsTotal)}
            </span>{" "}
            bags sold across{" "}
            <span className="font-semibold text-viz-1 tabular-nums">
              {formatNumber(bagItemsSold)}
            </span>{" "}
            inventory items
          </>
        ),
        table: (
          <RankedTable
            rows={topInventory}
            defaultSort="bags"
            barKey="bags"
            shareTotal={bagsTotal}
            percentAfter="colorName"
            initialRows={TOP_INVENTORY}
            columns={[
              {
                key: "name",
                label: "Item",
                render: (r) => (
                  <span className="font-semibold">{r.name || "—"}</span>
                ),
              },
              {
                key: "colorName",
                label: "Color",
                render: (r) =>
                  r.colorName ? (
                    <ColorSwatch
                      color={r.colorHex}
                      label={r.colorName}
                      className="whitespace-nowrap"
                    />
                  ) : (
                    "—"
                  ),
              },
              {
                key: "bags",
                label: "Bags sold",
                align: "right",
                render: (r) => formatNumber(r.bags),
              },
              {
                key: "orders",
                label: "Orders",
                align: "right",
                render: (r) => formatNumber(r.orders),
              },
              {
                key: "revenue",
                label: "Revenue",
                align: "right",
                render: (r) => formatMoney(r.revenue),
              },
            ]}
          />
        ),
      },
      {
        value: "extra",
        label: "Extra bags",
        count: ch.extraBags.length,
        title: "Extra bags sold",
        description: "Extra sub-collection bags",
        table: (
          <RankedTable
            rows={ch.extraBags}
            defaultSort="quantity"
            barKey="quantity"
            columns={[
              {
                key: "name",
                label: "Extra bag",
                render: (r) => <span className="font-semibold">{r.name}</span>,
              },
              {
                key: "quantity",
                label: "Qty",
                align: "right",
                render: (r) => formatNumber(r.quantity),
              },
              {
                key: "orders",
                label: "Orders",
                align: "right",
                render: (r) => formatNumber(r.orders),
              },
              {
                key: "revenue",
                label: "Revenue",
                align: "right",
                render: (r) => formatMoney(r.revenue),
              },
            ]}
          />
        ),
      },
      {
        value: "customers",
        label: "Top customers",
        count: ch.topCustomers.length,
        title: "Top customers",
        description: "Who spent the most in this range",
        table: (
          <RankedTable
            rows={ch.topCustomers}
            defaultSort="spent"
            barKey="spent"
            emptyText="No dealer or wholesale orders in this range"
            columns={[
              {
                key: "name",
                label: "Customer",
                render: (r) => (
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold">{r.name || "—"}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {r.email}
                    </span>
                  </div>
                ),
              },
              {
                key: "orders",
                label: "Orders",
                align: "right",
                render: (r) => formatNumber(r.orders),
              },
              {
                key: "spent",
                label: "Spent",
                align: "right",
                render: (r) => formatMoney(r.spent),
              },
            ]}
          />
        ),
      },
    ];

    body = (
      <div
        className={`flex flex-col gap-4 transition-opacity duration-200 ${isFetching ? "opacity-60" : ""}`}
        aria-busy={isFetching}
      >
        {/* ── KPIs ── */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Total sales"
            info={FEES_NOTE}
            value={formatMoney(kpis.sales.current)}
            current={kpis.sales.current}
            previous={kpis.sales.previous}
            trend={salesTrend}
          />
          <StatTile
            label="Total orders"
            value={formatNumber(kpis.orders.current)}
            current={kpis.orders.current}
            previous={kpis.orders.previous}
            trend={ordersTrend}
          />
          <StatTile
            label="Average order"
            value={formatMoney(kpis.averageOrder.current)}
            current={kpis.averageOrder.current}
            previous={kpis.averageOrder.previous}
            trend={avgTrend}
          />
          <StatTile
            label="Refunds"
            value={formatMoney(kpis.refunds.amount)}
            hint={plural(kpis.refunds.orders, "refunded order")}
            footer={
              <RefundRate
                refunded={kpis.refunds.amount}
                sales={kpis.sales.current}
              />
            }
          />
        </div>

        {/* ── Sales trend (full width) ── */}
        <SalesTrend periods={periods} bucket={bucket} />

        {/* ── Order mix + payment ── */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Panel
            title="Orders by type"
            description="Sales from dealer, wholesale and product orders"
          >
            <DonutChart
              emptyText="No paid orders in this range"
              emptyHint="Try a wider date range."
              emptyIcon={ChartPie}
              centerLabel="Total sales"
              centerValue={formatCompact(kpis.sales.current, { money: true })}
              rows={[...data.byType]
                .sort((a, b) => b.sales - a.sales)
                .map((r) => ({
                  key: r.type,
                  label: typeLabel(r.type),
                  value: r.sales,
                  display: formatMoney(r.sales),
                  sub: plural(r.orders, "order"),
                  color: ORDER_TYPES[r.type]?.color || "var(--viz-other)",
                }))}
            />
          </Panel>
          <Panel
            title="Payment method"
            description="Which gateway customers paid with"
          >
            <DonutChart
              emptyText="No payments in this range"
              emptyHint="Try a wider date range."
              emptyIcon={CreditCard}
              centerLabel="Paid orders"
              centerValue={formatNumber(kpis.orders.current)}
              rows={[...data.byGateway]
                .sort((a, b) => b.sales - a.sales)
                .map((r) => ({
                  key: r.gateway,
                  label: gatewayLabel(r.gateway),
                  value: r.sales,
                  display: formatMoney(r.sales),
                  sub: plural(r.orders, "order"),
                  color: GATEWAYS[r.gateway] || "var(--viz-other)",
                }))}
            />
          </Panel>
        </div>

        {/* ── Status + money ── */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Panel
            title="Order status"
            description="Every order placed in this range"
          >
            <SegmentBar
              rows={statusRows}
              totalLabel="orders placed"
              emptyText="No orders in this range"
              emptyHint="Try a wider date range."
              emptyIcon={ClipboardList}
            />
            {(toShip > 0 || held > 0) && (
              <div className="mt-auto flex flex-col gap-2 border-t pt-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Needs attention
                </span>
                {/* One tile takes the full width; two sit side by side. */}
                <div
                  className={`grid gap-2 ${toShip > 0 && held > 0 ? "grid-cols-2" : "grid-cols-1"}`}
                >
                  {toShip > 0 && (
                    <Link
                      to="/admin/orders"
                      className="group flex flex-col rounded-lg bg-success/10 px-3 py-2 hover:bg-success/15 transition-colors"
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-lg font-bold tabular-nums leading-tight">
                          {toShip}
                        </span>
                        <ArrowUpRight className="size-4 text-success transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        To ship
                      </span>
                    </Link>
                  )}
                  {held > 0 && (
                    <Link
                      to="/admin/orders"
                      className="group flex flex-col rounded-lg bg-amber-500/10 px-3 py-2 hover:bg-amber-500/15 transition-colors"
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-lg font-bold tabular-nums leading-tight">
                          {held}
                        </span>
                        <ArrowUpRight className="size-4 text-amber-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Held in storage
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Revenue breakdown"
            description="What customers paid for items, shipping, insurance and tax"
          >
            {grossCollected === 0 && breakdown.discounts === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No money collected in this range"
                description="Try a wider date range."
              />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">
                    {formatMoney(totalCollected)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    collected
                  </span>
                </div>

                {/* What each part contributes — zero parts take no space in the bar. */}
                <div
                  className="flex h-2.5 gap-[2px]"
                  role="img"
                  aria-label="Money collected by source"
                >
                  {moneyRows
                    .filter((r) => r.amount > 0)
                    .map((r) => (
                      <div
                        key={r.key}
                        title={`${r.label}: ${formatMoney(r.amount)}`}
                        className={`${r.color} h-full first:rounded-l-full last:rounded-r-full`}
                        style={{
                          width: `${(r.amount / (grossCollected || 1)) * 100}%`,
                          minWidth: 4,
                        }}
                      />
                    ))}
                </div>

                <ul className="flex flex-col -mx-2">
                  {moneyRows.map((r) => {
                    const Icon = r.icon;
                    return (
                      <li
                        key={r.key}
                        className={`flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors ${r.amount ? "" : "opacity-60"}`}
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ${r.chip}`}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-medium leading-tight">
                            {r.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {r.hint}
                          </span>
                        </span>
                        <span className="flex flex-col items-end">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatMoney(r.amount)}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {formatPercent(r.amount, grossCollected)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* Discounts come off the total, so they sit apart from what was added. */}
                <div className="mt-auto flex items-center gap-3 border-t pt-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md ring-1 text-muted-foreground bg-muted ring-border">
                    <Tag className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium leading-tight">
                      Discounts given
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Coupons and promo codes
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {breakdown.discounts > 0
                      ? `−${formatMoney(breakdown.discounts)}`
                      : formatMoney(0)}
                  </span>
                </div>

                <p className="flex items-start gap-1.5 rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
                  <Info className="size-3.5 shrink-0 mt-px" />
                  {FEES_NOTE}
                </p>
              </>
            )}
          </Panel>
        </div>

        {/* ── Dealer & Wholesale ── */}
        <div className="flex flex-col gap-4 pt-2">
          <div className="border-t pt-5">
            {/* Toggle sits on the title line; it scopes the whole dashboard. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Dealer &amp; Wholesale</h2>
              <Segmented
                label="Order type"
                value={channel}
                onChange={setChannel}
                options={CHANNEL_OPTIONS}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              What {CHANNEL_BUYERS[channel] || CHANNEL_BUYERS.all} bought in
              this range.
            </p>
          </div>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Sales"
              value={formatMoney(ch.sales.current)}
              current={ch.sales.current}
              previous={ch.sales.previous}
            />
            <StatTile
              label="Orders"
              value={formatNumber(ch.orders.current)}
              current={ch.orders.current}
              previous={ch.orders.previous}
            />
            <StatTile
              label="Bundles"
              value={formatNumber(bundleCopies)}
              hint="total qty sold"
            />
            <StatTile
              label="Torso bags"
              value={formatNumber(torsoTotal)}
              hint={`across ${plural(ch.torsoBags.length, "bag number")}`}
            />
            <StatTile
              label="Add-ons"
              value={formatNumber(addonCopies)}
              hint="total qty sold"
            />
          </div>

          <Tabs defaultValue="bundles" className="gap-4">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="h-auto p-1 gap-1">
                {tabs.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="px-3 py-1.5 gap-2"
                  >
                    {t.label}
                    <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {t.count}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {tabs.map((t) => (
              <TabsContent key={t.value} value={t.value}>
                <Panel title={t.title} description={t.description}>
                  {t.table}
                </Panel>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-popover-foreground/80 mt-2">
            {data
              ? `${periodDate(dates.from).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} – ${periodDate(dates.to).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
              : "Sales, orders and dealer/wholesale activity."}
          </p>
        </div>
        {filters}
      </div>
      {body}
    </div>
  );
};

export default Dashboard;
