import React from "react";
import { Link } from "react-router-dom";
import CommonImage from "@/components/shared/CommonImage";
import DiscountBadge from "@/components/shared/DiscountBadge";
import { formatCurrency } from "@/utils/formatting";

// Two densities of the same row: "sm" for the admin order modal, "md" for the
// customer-facing receipt where the type runs a step larger.
const SIZES = {
  sm: {
    image: "w-16",
    thumb: 128,
    title: "text-xs",
    detail: "text-xs",
    detailGap: "gap-1",
  },
  md: {
    image: "w-20",
    thumb: 160,
    title: "text-sm",
    detail: "text-xs",
    detailGap: "gap-1.5",
  },
};

// One line item inside an order view: thumbnail on the left, name and quantity
// on the first line, then a dot-separated detail row (bin, colour) that ends
// with the pre-discount total struck through beside what was charged.
//
// Shared by the dealer add-on manifest, the plain product items and the
// checkout receipt so an order reads the same wherever it appears — the
// variants only differ in which details they have to show, not in the layout.
const OrderItemRow = ({
  imageUrl,
  name,
  // Rendered right after the name, inside the same line (e.g. pieces per bag).
  nameSuffix,
  // When set, the name links here (the product detail page).
  to,
  quantity,
  // Singular noun; pluralised with a trailing "s" when quantity !== 1.
  quantityUnit = "item",
  // Strings such as bin or colour. Falsy entries are dropped.
  meta = [],
  // Per-unit prices — only used to work out the "N% OFF" chip.
  unitPrice,
  originalUnitPrice,
  // Line totals. The original is struck through when it beats what was paid.
  originalTotalPrice,
  totalPrice,
  size = "sm",
}) => {
  const s = SIZES[size] || SIZES.sm;
  const details = meta.filter(Boolean);
  const showTotal = totalPrice > 0;
  const showOriginalTotal =
    showTotal && originalTotalPrice != null && originalTotalPrice > totalPrice;
  const showDetailRow = details.length > 0 || showTotal || !imageUrl;

  const title = (
    <>
      {name}
      {nameSuffix}
    </>
  );

  return (
    <div className="flex items-center gap-3 rounded-md border p-2">
      {imageUrl && (
        <div className="relative shrink-0">
          <CommonImage
            src={imageUrl}
            alt={name}
            thumb={s.thumb}
            className={s.image}
          />
          <DiscountBadge
            originalPrice={originalUnitPrice}
            paidPrice={unitPrice}
            className="absolute top-0 right-0 z-10"
          />
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {to ? (
            <Link
              to={to}
              className={`${s.title} font-semibold truncate hover:text-success transition-colors`}
            >
              {title}
            </Link>
          ) : (
            <p className={`${s.title} font-semibold truncate`}>{title}</p>
          )}
          {quantity != null && (
            <span className={`${s.detail} text-muted-foreground shrink-0`}>
              <span className="font-bold text-red-600 dark:text-red-500">
                {quantity}
              </span>{" "}
              {quantity !== 1 ? `${quantityUnit}s` : quantityUnit}
            </span>
          )}
        </div>

        {showDetailRow && (
          <div className={`flex items-center ${s.detailGap} ${s.detail}`}>
            {details.map((detail, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-muted-foreground">·</span>}
                <span className="text-muted-foreground">{detail}</span>
              </React.Fragment>
            ))}
            {details.length > 0 && showTotal && (
              <span className="text-muted-foreground">·</span>
            )}
            {showOriginalTotal && (
              <span className="text-muted-foreground line-through">
                {formatCurrency(originalTotalPrice)}
              </span>
            )}
            {showTotal && (
              <span className="font-semibold text-success dark:text-accent">
                {formatCurrency(totalPrice)}
              </span>
            )}
            {/* No thumbnail to overlay — keep the discount visible inline. */}
            {!imageUrl && (
              <DiscountBadge
                originalPrice={originalUnitPrice}
                paidPrice={unitPrice}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderItemRow;
