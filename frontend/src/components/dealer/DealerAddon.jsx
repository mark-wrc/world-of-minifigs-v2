import { formatCurrency } from "@/utils/formatting";
import { ArrowRight, Sparkles, ShoppingBag, Zap, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TYPE_CONFIG = {
  upgrade: {
    Icon: Zap,
    headerBg: "bg-primary",
    headerText: "text-primary-foreground",
    chip: "bg-white/20 text-white",
    label: "Upgrade",
  },
  bundle: {
    Icon: Layers,
    headerBg: "bg-foreground dark:bg-card",
    headerText: "text-background dark:text-foreground",
    chip: "bg-white/10 text-white/80 dark:bg-white/10 dark:text-white/70",
    label: "Bundle",
  },
};

const getSavingsPct = (addon) => {
  const hasDiscount =
    addon.discountPrice !== null && addon.discountPrice !== undefined;
  const originalVal = Number(addon.price || 0);
  if (!hasDiscount || originalVal === 0) return null;
  const pct = Math.round((1 - Number(addon.discountPrice) / originalVal) * 100);
  return pct > 0 ? pct : null;
};

const DealerAddon = ({ addons, onSelect, onPreview }) => (
  <section id="step2">
    <div className="text-left mb-6">
      <div className="flex items-center gap-2 mb-1.5">
        <h2 className="text-2xl font-bold tracking-tight">
          Step 2 — Select your add-ons
        </h2>
        <Badge
          variant="outline"
          className="text-[10px] uppercase tracking-wide shrink-0"
        >
          Optional
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        Select premium part packages to enhance your bulk order
      </p>
    </div>

    <div className="grid gap-x-3 gap-y-5  grid-cols-[repeat(auto-fit,minmax(220px,1fr))] pt-5">
      {addons.map((addon) => {
        const cfg = TYPE_CONFIG[addon.addonType] ?? TYPE_CONFIG.bundle;
        const { Icon, headerBg, headerText, chip, label } = cfg;
        const savingsPct = getSavingsPct(addon);

        const hasDiscount =
          addon.discountPrice !== null && addon.discountPrice !== undefined;
        const isFree = hasDiscount && Number(addon.discountPrice) === 0;
        const discountedVal = hasDiscount ? Number(addon.discountPrice) : null;
        const originalVal = Number(addon.price || 0);

        const isSelected = addon.isSelected;
        const isOutOfStock = addon.isOutOfStock;

        return (
          <div key={addon._id} className="relative mt-1">
            {/* ── Out of Stock centered badge ── */}
            {isOutOfStock && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                <span className="inline-flex items-center bg-destructive text-white text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
                  Out of Stock
                </span>
              </div>
            )}

            {/* ── Card ── */}
            <div
              onClick={() => {
                if (isOutOfStock) return;
                addon.hasItems ? onPreview(addon) : onSelect(addon._id);
              }}
              className={`
                group flex flex-col rounded-xl overflow-hidden
                cursor-pointer transition-all duration-300 select-none
                hover:shadow-2xl hover:-translate-y-2
                ${
                  isSelected
                    ? "ring-2 ring-accent ring-offset-2 dark:ring-offset-background shadow-lg"
                    : "shadow-sm hover:shadow-xl"
                }
                ${isOutOfStock ? "opacity-50 grayscale cursor-not-allowed" : ""}
              `}
            >
              {/* ── Colored header ── */}
              <div
                className={`
                  relative flex flex-col gap-2 px-5 pt-5 pb-4 overflow-hidden
                  ${headerBg}
                `}
              >
                {/* Decorative circle */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

                {/* Badge (if set) + savings */}
                <div className="flex items-center justify-between gap-2 h-5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${chip}`}
                  >
                    {addon.badge || label}
                  </span>

                  {savingsPct && !isOutOfStock && (
                    <span className="inline-flex items-center gap-0.5 bg-success text-white text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md">
                      <Sparkles className="w-2.5 h-2.5" />
                      {savingsPct}% off
                    </span>
                  )}
                </div>

                {/* Icon + Name */}
                <div className="flex items-center gap-2 mt-5">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                    <Icon className={`w-4 h-4 ${headerText}`} strokeWidth={2} />
                  </div>
                  <h3
                    className={`font-extrabold text-lg uppercase ${headerText}`}
                  >
                    {addon.addonName}
                  </h3>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex flex-col flex-1 bg-card border border-t-0 border-border rounded-b-xl p-4 gap-5">
                <p className="text-sm text-muted-foreground">
                  {addon.description || "—"}
                </p>

                {/* ── Footer: price + CTA ── */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
                  {/* Price */}
                  {addon.addonType === "upgrade" ? (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl font-black text-success dark:text-accent leading-none">
                        {hasDiscount
                          ? isFree
                            ? "FREE"
                            : formatCurrency(discountedVal)
                          : !originalVal
                            ? "FREE"
                            : formatCurrency(originalVal)}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs font-medium text-muted-foreground line-through leading-none">
                          {formatCurrency(originalVal)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ShoppingBag className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-semibold">
                        Per item pricing
                      </span>
                    </div>
                  )}

                  {/* CTA button */}
                  <button
                    className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg transition-all duration-200 group-hover:gap-2.5 ${isSelected ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground group-hover:bg-primary/90"}`}
                  >
                    {isSelected ? "Added" : "Select"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export default DealerAddon;
