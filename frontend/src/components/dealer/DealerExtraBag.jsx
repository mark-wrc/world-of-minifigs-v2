import { Badge } from "@/components/ui/badge";
import QuantityControl from "@/components/shared/QuantityControl";
import { Card } from "@/components/ui/card";

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
          <Badge
            variant="outline"
            className="flex items-center self-start md:self-auto"
          >
            <div className="flex items-center gap-1 text-primary">
              <span className="text-lg font-bold">{totalExtraBags}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-lg font-bold">
                {maxExtraBags} extra bags
              </span>
            </div>
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        Add additional part bags to your order based on your selected bundle
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {extraBags.map((bag) => {
        const handleQuantityChange = (newVal) => onQtyChange(bag._id, newVal);

        return (
          <Card
            key={bag._id}
            className={`p-5 transition-all duration-300 group overflow-visible hover:shadow-2xl hover:-translate-y-2 flex flex-col gap-2 ${
              bag.qty > 0
                ? "border-accent ring-2 ring-accent ring-offset-2"
                : ""
            }`}
          >
            <h3 className="text-lg font-bold text-left">
              {bag.subCollectionId?.subCollectionName || "Extra Bag"}
            </h3>

            <div className="w-full flex flex-col mt-2">
              <span className="text-4xl font-extrabold text-success dark:text-accent">
                ${bag.price}
              </span>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  Per Extra Bag
                </span>
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary text-[9px] px-1.5 h-4 font-bold uppercase tracking-tight"
                >
                  100 Pcs
                </Badge>
              </div>
            </div>

            <div className="mt-2 w-full">
              <QuantityControl
                value={bag.qty}
                onChange={handleQuantityChange}
                min={0}
                max={bag.max}
                size="md"
              />
            </div>
          </Card>
        );
      })}
    </div>
  </section>
);

export default DealerExtraBag;
