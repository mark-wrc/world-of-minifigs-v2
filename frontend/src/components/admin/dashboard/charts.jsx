import React from "react";
import { Inbox } from "lucide-react";

// Charts for the admin dashboard — plain SVG, no chart library.
// Marks follow one spec: 2px lines, a ~10% area wash, hairline grid, 2px
// surface gaps between touching fills, and a hover/focus layer on every chart.

// ------------------------------- Helpers ------------------------------------

// Shared "nothing here yet" block — centred in whatever card it sits in.
export const EmptyState = ({ icon, title, description, className = "" }) => {
  const Icon = icon || Inbox;
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center ${className}`}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="max-w-60 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
};

// Round the axis top up to a clean step (1, 2, 2.5, 5 × 10ⁿ) over 4 ticks.
const niceScale = (max, ticks = 4) => {
  if (max <= 0) return { top: ticks, step: 1 };
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ||
    10 * magnitude;
  return { top: step * ticks, step };
};

// Track an element's width so SVGs draw at real pixel size.
const useWidth = () => {
  const ref = React.useRef(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};

// ------------------------------- Trend (area) chart ------------------------------------

/**
 * Single-series area chart with a snapping crosshair and tooltip.
 * points: [{ key, label, value }]; renderTooltip(point) returns extra rows.
 */
export const TrendChart = ({
  points,
  formatValue,
  formatAxis,
  renderTooltip,
  height = 240,
  ariaLabel,
  empty,
}) => {
  const [ref, width] = useWidth();
  const [active, setActive] = React.useState(null);
  const gradientId = React.useId();

  const pad = { top: 16, right: 16, bottom: 30, left: 52 };
  const innerW = Math.max(width - pad.left - pad.right, 0);
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...points.map((p) => p.value), 0);
  const { top, step } = niceScale(max);

  const x = (i) =>
    pad.left +
    (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - (v / top) * innerH;

  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`)
    .join("");
  const area =
    points.length > 0
      ? `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
      : "";

  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);

  // ~6 evenly spaced date labels, always including the last.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const last = points.length - 1;
  const showLabel = (i) =>
    i === last || (i % labelEvery === 0 && last - i >= labelEvery * 0.6);

  const indexAt = (clientX) => {
    const rect = ref.current.getBoundingClientRect();
    const px = clientX - rect.left - pad.left;
    if (points.length <= 1) return 0;
    const i = Math.round((px / innerW) * (points.length - 1));
    return Math.min(points.length - 1, Math.max(0, i));
  };

  const handleKey = (e) => {
    if (!points.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((i) => {
        const current = i ?? points.length - 1;
        const next = current + (e.key === "ArrowRight" ? 1 : -1);
        return Math.min(points.length - 1, Math.max(0, next));
      });
    }
    if (e.key === "Escape") setActive(null);
  };

  // An all-zero range keeps its axes but says so, instead of a flat line.
  const isEmpty = Boolean(empty) && points.every((p) => !p.value);
  const point = active !== null && !isEmpty ? points[active] : null;
  const tipLeft = point ? Math.min(Math.max(x(active), 90), width - 90) : 0;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md touch-none"
          onPointerMove={(e) => setActive(indexAt(e.clientX))}
          onPointerDown={(e) => setActive(indexAt(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={handleKey}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity="0.22" />
              <stop
                offset="100%"
                stopColor="var(--success)"
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>

          {/* Grid + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              {/* An empty range has no real scale — keep the grid, drop the numbers. */}
              {!isEmpty && (
                <text
                  x={pad.left - 10}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {formatAxis(t)}
                </text>
              )}
            </g>
          ))}

          {/* X labels */}
          {points.map((p, i) =>
            showLabel(i) ? (
              <text
                key={p.key}
                x={x(i)}
                y={height - 8}
                textAnchor={
                  points.length > 1 && i === 0
                    ? "start"
                    : i === points.length - 1 && points.length > 1
                      ? "end"
                      : "middle"
                }
                className="fill-muted-foreground text-[11px]"
              >
                {p.label}
              </text>
            ) : null,
          )}

          <path
            d={area}
            fill={`url(#${gradientId})`}
            className="animate-in fade-in duration-500"
          />
          <path
            d={line}
            fill="none"
            stroke="var(--success)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="animate-in fade-in duration-500"
          />

          {/* Single-point ranges still show a dot */}
          {points.length === 1 && (
            <circle
              cx={x(0)}
              cy={y(points[0].value)}
              r="4"
              fill="var(--success)"
            />
          )}

          {point && (
            <g pointerEvents="none">
              <line
                x1={x(active)}
                x2={x(active)}
                y1={pad.top}
                y2={pad.top + innerH}
                stroke="var(--muted-foreground)"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <circle
                cx={x(active)}
                cy={y(point.value)}
                r="5"
                fill="var(--success)"
                stroke="var(--card)"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      )}

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl bg-card/90 px-6">
            <EmptyState {...empty} />
          </div>
        </div>
      )}

      {point && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border bg-popover text-popover-foreground shadow-lg px-3 py-2 text-xs min-w-40"
          style={{ left: tipLeft, top: 0 }}
          role="status"
        >
          <div className="text-muted-foreground mb-1">
            {point.tooltipLabel || point.label}
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full bg-success" />
            <span className="text-sm font-semibold tabular-nums">
              {formatValue(point.value)}
            </span>
          </div>
          {renderTooltip?.(point)}
        </div>
      )}
    </div>
  );
};

// ------------------------------- Sparkline ------------------------------------

export const Sparkline = ({ values, height = 36 }) => {
  const [ref, width] = useWidth();
  const gradientId = React.useId();
  const max = Math.max(...values, 0) || 1;
  const n = values.length;
  const x = (i) => (n <= 1 ? width / 2 : (i / (n - 1)) * (width - 4) + 2);
  const y = (v) => height - 3 - (v / max) * (height - 8);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");

  return (
    <div ref={ref} className="w-full" style={{ height }} aria-hidden="true">
      {width > 0 && n > 1 && (
        <svg width={width} height={height} className="block">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line}L${x(n - 1)},${height}L${x(0)},${height}Z`}
            fill={`url(#${gradientId})`}
          />
          <path
            d={line}
            fill="none"
            stroke="var(--success)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={x(n - 1)}
            cy={y(values[n - 1])}
            r="3"
            fill="var(--success)"
            stroke="var(--card)"
            strokeWidth="1.5"
          />
        </svg>
      )}
    </div>
  );
};

// ------------------------------- Donut ------------------------------------

const arcPath = (cx, cy, r, inner, start, end) => {
  const large = end - start > Math.PI ? 1 : 0;
  const p = (radius, angle) => [
    cx + radius * Math.sin(angle),
    cy - radius * Math.cos(angle),
  ];
  const [x1, y1] = p(r, start);
  const [x2, y2] = p(r, end);
  const [x3, y3] = p(inner, end);
  const [x4, y4] = p(inner, start);
  return `M${x1},${y1}A${r},${r} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${inner},${inner} 0 ${large} 0 ${x4},${y4}Z`;
};

/**
 * Donut with a hover-linked legend. rows: [{ key, label, value, display, sub, color }]
 * where color is a CSS color usable as an SVG fill.
 */
export const DonutChart = ({
  rows,
  centerLabel,
  centerValue,
  emptyText,
  emptyHint,
  emptyIcon,
}) => {
  const [active, setActive] = React.useState(null);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const size = 150;
  const r = size / 2;
  const inner = r - 22;

  if (!total) {
    return (
      <EmptyState icon={emptyIcon} title={emptyText} description={emptyHint} />
    );
  }

  const slices = rows.reduce((acc, row) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    acc.push({ ...row, start, end: start + (row.value / total) * Math.PI * 2 });
    return acc;
  }, []);

  const current = active ? rows.find((row) => row.key === active) : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={centerLabel}>
          {slices.map((s) =>
            s.end - s.start >= Math.PI * 2 - 0.0001 ? (
              <circle
                key={s.key}
                cx={r}
                cy={r}
                r={(r + inner) / 2}
                fill="none"
                stroke={s.color}
                strokeWidth={r - inner}
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
              />
            ) : (
              <path
                key={s.key}
                d={arcPath(r, r, r, inner, s.start, s.end)}
                fill={s.color}
                stroke="var(--card)"
                strokeWidth="2"
                className="transition-opacity duration-150 cursor-pointer"
                opacity={active && active !== s.key ? 0.35 : 1}
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
              />
            ),
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
          <span className="text-[11px] text-muted-foreground truncate max-w-full">
            {current ? current.label : centerLabel}
          </span>
          <span className="text-lg font-bold leading-tight">
            {current ? current.display : centerValue}
          </span>
          {current && (
            <span className="text-[11px] text-muted-foreground">
              {((current.value / total) * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-1 w-full min-w-0">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onPointerEnter={() => setActive(row.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(row.key)}
              onBlur={() => setActive(null)}
              className={`w-full flex items-start gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${active === row.key ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              {/* Sits on the name line (text-sm, 20px) rather than the middle of the row. */}
              <span
                className="mt-[5px] size-2.5 rounded-sm shrink-0"
                style={{ background: row.color }}
              />
              <span className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">
                  {row.label}
                </span>
                {row.sub && (
                  <span className="text-[11px] text-muted-foreground">
                    {row.sub}
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end">
                <span className="text-sm font-semibold tabular-nums">
                  {row.display}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {((row.value / total) * 100).toFixed(1)}%
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ------------------------------- Status breakdown ------------------------------------

/**
 * Total, one 100% bar split by status, and a row per status with its icon,
 * count and share — status colors never carry meaning alone.
 * rows: [{ key, label, hint, value, color, chip, icon }]
 */
export const SegmentBar = ({
  rows,
  emptyText,
  emptyHint,
  emptyIcon,
  totalLabel = "orders",
}) => {
  const [active, setActive] = React.useState(null);
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total)
    return (
      <EmptyState icon={emptyIcon} title={emptyText} description={emptyHint} />
    );

  const hover = (key) => ({
    onPointerEnter: () => setActive(key),
    onPointerLeave: () => setActive(null),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight">
          {total.toLocaleString()}
        </span>
        <span className="text-sm text-muted-foreground">{totalLabel}</span>
      </div>

      <div
        className="flex h-2.5 gap-[2px]"
        role="img"
        aria-label="Orders by status"
      >
        {/* Zero rows stay in the list but take no space in the bar. */}
        {rows
          .filter((row) => row.value > 0)
          .map((row) => (
            <div
              key={row.key}
              title={`${row.label}: ${row.value}`}
              className={`${row.color} h-full first:rounded-l-full last:rounded-r-full transition-opacity duration-150`}
              style={{
                width: `${(row.value / total) * 100}%`,
                minWidth: 4,
                opacity: active && active !== row.key ? 0.3 : 1,
              }}
              {...hover(row.key)}
            />
          ))}
      </div>

      <ul className="flex flex-col -mx-2">
        {rows.map((row) => {
          const Icon = row.icon;
          const share = (row.value / total) * 100;
          return (
            <li
              key={row.key}
              {...hover(row.key)}
              className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors ${active === row.key ? "bg-muted" : ""} ${row.value ? "" : "opacity-60"}`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ${row.chip}`}
              >
                {Icon && <Icon className="size-4" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium leading-tight">
                  {row.label}
                </span>
                {row.hint && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {row.hint}
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end">
                <span className="text-sm font-semibold tabular-nums">
                  {row.value.toLocaleString()}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {share.toFixed(share > 0 && share < 1 ? 1 : 0)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
