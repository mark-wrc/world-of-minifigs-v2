import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/utils/formatting";

const DealerBundle = ({ bundles, onSelect }) => (
  <section className="px-5 py-10 bg-input/50 dark:bg-card/50">
    <div className="text-left mb-10">
      <h2 className="text-2xl font-bold mb-2 tracking-tight">
        Select Your Bag Quantities
      </h2>
      <p className="text-muted-foreground text-sm">
        Top-quality, 100% genuine LEGO minifigures — select one or more bundles
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {bundles.map((bundle) => (
        <Card
          key={bundle._id}
          onClick={() => onSelect(bundle._id)}
          className={`relative cursor-pointer transition-all duration-300 group hover:shadow-2xl hover:-translate-y-2 p-5 ${
            bundle.isSelected
              ? "border-accent ring-2 ring-accent ring-offset-2"
              : ""
          }`}
        >
          {bundle.isSelected && (
            <Badge
              variant="accent"
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 whitespace-nowrap z-10 uppercase"
            >
              Selected
            </Badge>
          )}

          <h3 className="text-2xl font-bold mt-3 text-left">
            {bundle.bundleName}
          </h3>

          <div className="w-full flex flex-col mt-3">
            <span className="text-5xl font-extrabold text-success dark:text-accent">
              ${bundle.totalPrice}
            </span>
            <span className="text-xs text-primary font-semibold mt-2">
              {formatCurrency(bundle.unitPrice)} / each
            </span>
          </div>

          <ul className="space-y-3 flex-1 w-full overflow-hidden border-t border-dashed border-border pt-5">
            {bundle.features?.map((feature, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm leading-tight"
              >
                <Check size={16} className="text-primary shrink-0" />
                <span className="text-muted-foreground/90">{feature}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  </section>
);

export default DealerBundle;
