import { formatCurrency } from "@/utils/formatting";
import { ArrowRight, Sparkles, ShoppingBag, Zap, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const HEADER_BG = "bg-foreground dark:bg-card";
const HEADER_TEXT = "text-background dark:text-foreground";
const CHIP = "bg-accent dark:bg-accent";

const TYPE_CONFIG = {
  upgrade: { Icon: Zap },
  bundle: { Icon: Layers },
};

const DealerAddon = ({ addons, onSelect, onPreview }) => (
  <section id="step2">
    <div className="text-left mb-5">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-2xl font-bold tracking-tight">Select your add-ons</h2>
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

    <div className="grid gap-x-3 gap-y-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pt-5">
      {addons.map((addon) => {
        const cfg = TYPE_CONFIG[addon.addonType] ?? TYPE_CONFIG.bundle;
        const { Icon } = cfg;
        // Read backend-stored values directly — no recomputation here.
        const savingsPct =
          addon.discount > 0 ? Math.round(addon.discount) : null;

        const hasDiscount =
          addon.discountPrice !== null && addon.discountPrice !== undefined;
        const isFree = hasDiscount && Number(addon.discountPrice) === 0;
        const discountedVal = hasDiscount ? Number(addon.discountPrice) : null;
        const originalVal = Number(addon.price || 0);

        const isSelected = addon.isSelected;

        const hasBgImage = !!addon.image?.url;

        return (
          <div key={addon._id} className="relative">
            {/* ── Card ── */}
            <div
              onClick={() => {
                addon.hasItems ? onPreview(addon) : onSelect(addon._id);
              }}
              className="group flex flex-col rounded-xl overflow-hidden
                cursor-pointer transition-all duration-300 select-none
                hover:shadow-2xl hover:-translate-y-2"
            >
              {/* ── Colored header ── */}
              <div
                className={`
                  relative flex flex-col gap-2 px-5 p-4 overflow-hidden min-h-40
                  ${HEADER_BG}
                `}
              >
                {/* Background image + dark overlay for legibility */}
                {hasBgImage && (
                  <>
                    <div
                      className="absolute inset-0 bg-contain bg-center"
                      style={{ backgroundImage: `url(${addon.image.url})` }}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/20 to-transparent" />
                  </>
                )}

                {/* Decorative circles (hidden when image is present so they don't muddy it) */}
                {!hasBgImage && (
                  <>
                    <div className="absolute -bottom-6 -right-6 w-14 h-24 rounded-full bg-white/5 pointer-events-none" />
                    <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />
                  </>
                )}

                {/* Badge (if set) + savings */}
                <div className="relative z-10 flex items-center justify-end gap-2 h-5">
                  {addon.badge && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md mr-auto ${CHIP}`}
                    >
                      {addon.badge}
                    </span>
                  )}

                  {savingsPct && (
                    <span className="inline-flex items-center gap-2 bg-success text-white text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md">
                      <Sparkles className="w-2.5 h-2.5" />
                      {savingsPct}% off!
                    </span>
                  )}
                </div>

                {/* Icon + Name */}
                <div className="relative z-10 flex items-center gap-2 mt-auto">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                    <Icon
                      className={`w-4 h-4 ${HEADER_TEXT}`}
                      strokeWidth={2}
                    />
                  </div>
                  <h3
                    className={`font-extrabold text-lg md:text-xl uppercase tracking-widest ${HEADER_TEXT}`}
                  >
                    {addon.addonName}
                  </h3>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex flex-col flex-1 bg-card border border-t-0 border-border rounded-b-xl p-4 gap-5">
                <p className="text-sm text-muted-foreground leading-snug line-clamp-4 flex-1 min-h-15">
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
                        <span className="text-lg font-bold text-destructive line-through leading-none">
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
                    className={`shrink-0 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg cursor-pointer ${isSelected ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground group-hover:bg-primary/90"}`}
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
