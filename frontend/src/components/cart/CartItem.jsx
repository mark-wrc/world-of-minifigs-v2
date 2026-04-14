import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CommonImage from "@/components/shared/CommonImage";
import QuantityControl from "@/components/shared/QuantityControl";

const CartItem = ({ item, onChange, onRemove }) => {
  const {
    productId,
    productName,
    variantIndex,
    quantity,
    image,
    displayPrice,
    originalPrice,
    hasDiscount,
    totalItemPrice,
    colorDisplay,
    stock,
  } = item;

  const handleQuantityChange = (newQty) =>
    onChange(newQty, productId, variantIndex);
  const handleRemove = () => onRemove(productId, variantIndex);

  return (
    <div className="flex items-center gap-3 group pb-5 border-b last:border-0 last:pb-0">
      <CommonImage
        src={image}
        alt={productName}
        className="w-32"
        objectFit="object-contain"
      />

      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="grid grid-cols-[1fr_auto] items-start gap-3">
            <h4
              className="font-bold text-sm leading-tight line-clamp-1 min-w-0"
              title={productName}
            >
              {productName}
            </h4>
            <span className="font-extrabold text-sm text-success dark:text-accent whitespace-nowrap">
              ${totalItemPrice}
            </span>
          </div>

          <div className="mt-1 space-y-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-bold">${displayPrice}</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  ${originalPrice}
                </span>
              )}
            </div>
            {colorDisplay && (
              <p className="text-xs text-muted-foreground">{colorDisplay}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <QuantityControl
            value={quantity}
            onChange={handleQuantityChange}
            min={1}
            max={stock}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-transparent"
            onClick={handleRemove}
            title="Remove item"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CartItem;
