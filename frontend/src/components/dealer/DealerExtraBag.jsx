import { Badge } from "@/components/ui/badge";
import QuantityControl from "@/components/shared/QuantityControl";
import { formatCurrency } from "@/utils/formatting";
import { Package } from "lucide-react";

const DealerExtraBag = ({
  extraBags,
  totalExtraBags,
  maxExtraBags,
  selectedBundle,
  onQtyChange,
}) => (
  <section id="step3" className="overflow-visible">
    <div className="flex flex-col mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Step 3 — Extra Part Bag Options
          </h2>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wide shrink-0"
          >
            Optional
          </Badge>
        </div>

        {selectedBundle && (
          <div
            className={`self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border ${
              totalExtraBags > 0
                ? "bg-accent/10 border-accent/30 text-accent-foreground dark:text-accent"
                : "bg-muted border-border text-muted-foreground"
            }`}
          >
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span>{totalExtraBags}</span>
            <span className="font-normal text-xs opacity-70">/</span>
            <span>{maxExtraBags} extra bags</span>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        Add additional part bags to your order based on your selected bundle
      </p>
    </div>

    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
      {extraBags.map((bag) => {
        const isActive = bag.qty > 0;
        const bagName = bag.subCollectionId?.subCollectionName || "Extra Bag";

        return (
          <div key={bag._id}>
            {/* ── Card ── */}
            <div
              className={`
                group flex flex-col rounded-xl overflow-hidden
                transition-all duration-300
                hover:shadow-2xl hover:-translate-y-2
                ${
                  isActive
                    ? "ring-2 ring-accent ring-offset-2 dark:ring-offset-background shadow-lg"
                    : "shadow-sm hover:shadow-xl"
                }
              `}
            >
              {/* ── Colored header ── */}
              <div className="relative flex flex-col gap-2 px-5 pt-5 pb-4 overflow-hidden bg-primary">
                {/* Decorative circles */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

                {/* Chip row */}
                <div className="flex items-center justify-between gap-2 h-5">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/10 text-white/80">
                    Extra Bag
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/10 text-white/80">
                    100 Pcs
                  </span>
                </div>

                {/* Icon + Name */}
                <div className="flex items-center gap-2 mt-5">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                    <Package
                      className="w-4 h-4 text-primary-foreground"
                      strokeWidth={2}
                    />
                  </div>
                  <h3 className="font-extrabold text-lg uppercase text-primary-foreground leading-tight">
                    {bagName}
                  </h3>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex flex-col flex-1 bg-card border border-t-0 border-border rounded-b-xl p-5 gap-4">
                {/* Price */}
                <div className="flex items-baseline gap-2 pt-2">
                  <span className="text-4xl font-black text-success dark:text-accent leading-none">
                    {formatCurrency(bag.price)}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    / bag
                  </span>
                </div>

                {/* Quantity control */}
                <div className="pt-2">
                  <QuantityControl
                    value={bag.qty}
                    onChange={(val) => onQtyChange(bag._id, val)}
                    min={0}
                    max={bag.max}
                    size="md"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export default DealerExtraBag;
