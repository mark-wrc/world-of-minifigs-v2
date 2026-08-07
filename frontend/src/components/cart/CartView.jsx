import React from "react";
import {
  SheetHeader,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { CheckoutButton } from "@/components/shared/OrderActionButton";
import ShippingCountrySelect from "@/components/shared/ShippingCountrySelect";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyCartView from "@/components/cart/EmptyCartView";
import CartItem from "@/components/cart/CartItem";

const CartView = ({
  items,
  totalPriceFormatted,
  totalQuantity,
  onQuantityChange,
  removeItem,
  closeSheet,
  isUpdating,
  onCheckout,
  isCheckoutLoading,
}) => (
  <div className="flex flex-col h-full relative">
    <SheetHeader className="p-5 border-b flex flex-row items-center justify-between">
      <SheetTitle className="text-2xl font-bold uppercase">
        Your Cart
        <sup className="text-sm font-bold text-muted-foreground ml-2">
          {totalQuantity}
        </sup>
      </SheetTitle>
      <SheetDescription className="sr-only">
        This is your shopping cart
      </SheetDescription>
    </SheetHeader>

    <div className="flex-1 overflow-y-auto p-5">
      {items.length === 0 && !isUpdating ? (
        <EmptyCartView onContinue={closeSheet} />
      ) : (
        <div className="space-y-5">
          {items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.variantIndex ?? "default"}`}
              item={item}
              onChange={onQuantityChange}
              onRemove={removeItem}
            />
          ))}
        </div>
      )}
    </div>

    {items.length > 0 && (
      <div className="px-5 py-3 border-t border-dashed space-y-5">
        <div className="flex justify-between">
          <span className="text-lg font-extrabold uppercase">Subtotal</span>
          <span className="text-2xl font-extrabold text-success dark:text-accent">
            ${totalPriceFormatted}
          </span>
        </div>
        <ShippingCountrySelect disabled={isCheckoutLoading} />
        <CheckoutButton
          onClick={onCheckout}
          disabled={isCheckoutLoading}
          isLoading={isCheckoutLoading}
          className="h-12"
        />
      </div>
    )}

    {isUpdating && (
      <div className="absolute inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 transition-all duration-300">
        <LoadingSpinner minHeight="min-h-0" />
      </div>
    )}
  </div>
);

export default CartView;
