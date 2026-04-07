import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/utils/formatting";

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

    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      {addons.map((addon) => (
        <Card
          key={addon._id}
          onClick={() => {
            if (addon.isOutOfStock) return;
            addon.hasItems ? onPreview(addon) : onSelect(addon._id);
          }}
          className={`relative cursor-pointer transition-all duration-300 group gap-2 hover:shadow-2xl hover:-translate-y-2 p-5 ${
            addon.isSelected
              ? "border-accent ring-2 ring-accent ring-offset-2"
              : ""
          } ${addon.isOutOfStock ? "opacity-60 grayscale-[0.5] cursor-not-allowed" : ""}`}
        >
          {addon.isSelected && (
            <Badge
              variant="accent"
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 whitespace-nowrap z-10 uppercase"
            >
              Selected
            </Badge>
          )}

          {addon.isOutOfStock && (
            <Badge
              variant="destructive"
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 whitespace-nowrap z-10 uppercase"
            >
              Out of Stock
            </Badge>
          )}

          <h3 className="text-xl font-bold text-left">{addon.addonName}</h3>

          <p className="text-sm text-muted-foreground leading-tight line-clamp-2">
            {addon.description}
          </p>

          {addon.addonType === "upgrade" && (
            <div className="w-full flex flex-col mt-4">
              <span className="text-4xl font-extrabold text-success dark:text-accent">
                {!addon.price || Number(addon.price) === 0
                  ? "Free"
                  : formatCurrency(addon.price)}
              </span>
              <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wide font-semibold">
                Add-on Price
              </span>
            </div>
          )}

          {addon.addonType === "bundle" && (
            <div className="w-full flex flex-col mt-4">
              <span className="text-4xl font-extrabold text-success dark:text-accent">
                Pick Items
              </span>
              <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wide font-semibold">
                Per Item Pricing
              </span>
            </div>
          )}
        </Card>
      ))}
    </div>
  </section>
);

export default DealerAddon;
