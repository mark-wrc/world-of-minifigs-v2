import { Zap } from "lucide-react";
import { useDealerFlashSale } from "@/hooks/useDealerFlashSale";

// The storefront announcement strip above the dealer/wholesale hero: one line of
// yellow and a live countdown.
//
// Sticks below the fixed header (h-20) so the deadline stays in view while the
// dealer scrolls the add-ons it applies to. Renders nothing at all when there's
// no sale — no placeholder, no reserved space, no layout shift.
const FlashSaleBar = ({ channel }) => {
  const { isVisible, isUpcoming, isUrgent, countdownParts } =
    useDealerFlashSale(channel);

  if (!isVisible) return null;

  return (
    <div className="sticky top-20 z-40 flex items-center justify-center gap-2 bg-accent px-5 py-2.5 text-black">
      {/* The only motion, and only in the final hour. */}
      <Zap
        className={`size-3.5 shrink-0 fill-current ${
          isUrgent ? "animate-pulse" : ""
        }`}
      />
      <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] sm:text-xs">
        Flash Sale · {isUpcoming ? "Starts in" : "Ends in"}
      </span>
      {/* One inverted box per unit so the deadline reads first on the strip.
          tabular-nums keeps the digits from resizing the boxes every second. */}
      <div className="flex shrink-0 items-center gap-1">
        {countdownParts.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-baseline gap-1 rounded-md bg-black px-2 py-1 leading-none text-accent"
          >
            <span className="text-xs font-extrabold tabular-nums sm:text-sm">
              {value}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.1em] opacity-70 sm:text-[9px]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlashSaleBar;
