// The "N% OFF" chip for flash-sale pricing, shared by the dealer add-on
// preview, the checkout receipt and the admin order view so a discount reads
// the same everywhere.
//
// Callers pass the two prices rather than a sale object, because the sources
// differ: live browsing has a resolved flash sale (originalPrice/salePrice)
// while an order carries the snapshot captured at purchase
// (originalPricePerBag/pricePerBag). Percent and fixed discounts both reduce
// to one normalized figure here, matching how the flash-sale banner advertises
// the campaign.
//
// Renders nothing unless the prices describe a real discount, so callers can
// drop it in unguarded.
const DiscountBadge = ({ originalPrice, paidPrice, className = "" }) => {
  const original = Number(originalPrice) || 0;
  const paid = Number(paidPrice) || 0;
  if (original <= 0 || paid <= 0 || paid >= original) return null;

  return (
    <span
      className={`shrink-0 rounded bg-destructive px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm ${className}`}
    >
      {Math.round(((original - paid) / original) * 100)}% Off
    </span>
  );
};

export default DiscountBadge;
