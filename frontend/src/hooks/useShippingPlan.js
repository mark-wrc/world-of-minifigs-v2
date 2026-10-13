import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useGetHeldOrdersQuery } from "@/redux/api/authApi";
import {
  SHIPPING_MODES,
  setShippingMode,
  setShippingInsurance,
} from "@/redux/slices/shippingSlice";
import { getShippingCountry } from "@shared/shippingData";

/**
 * Pay Now, Ship Later choice for the next checkout: ship now or hold the
 * order and ship later. Held orders ship through "Ship all now" on the
 * Purchase page, never alongside a new checkout.
 *
 * Held orders all share one flat rate, which is per country — so holding is
 * only offered when they go to the selected destination.
 */
export const useShippingPlan = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const { country, mode, insurance } = useSelector(
    (state) => state.shipping,
  );
  const { data: held } = useGetHeldOrdersQuery(undefined, {
    skip: !isAuthenticated,
  });

  const heldCount = held?.count ?? 0;
  const heldCountry = held?.country ?? null;
  const heldElsewhere =
    heldCount > 0 &&
    (held?.mixedCountries || (heldCountry && heldCountry !== country));
  const heldCountryLabel =
    getShippingCountry(heldCountry)?.label || heldCountry || "";

  const canHold = !heldElsewhere;
  const effectiveMode =
    mode === SHIPPING_MODES.HOLD && canHold
      ? SHIPPING_MODES.HOLD
      : SHIPPING_MODES.SHIP_NOW;

  const setMode = useCallback(
    (value) => dispatch(setShippingMode(value)),
    [dispatch],
  );
  const setInsurance = useCallback(
    (value) => dispatch(setShippingInsurance(value === true)),
    [dispatch],
  );

  return {
    mode: effectiveMode,
    setMode,
    isHold: effectiveMode === SHIPPING_MODES.HOLD,
    canHold,
    heldCount,
    heldCountryLabel,
    heldElsewhere,
    shippingRate: held?.shippingRate ?? null,
    heldOrdersSubtotal: held?.itemsSubtotal ?? 0,
    insurance,
    setInsurance,
    // Body fields for the create-checkout-session request.
    // Dealer / wholesale checkouts send their own shippingInsurance choice.
    checkoutFields: {
      shippingMode: effectiveMode,
      shippingInsurance: insurance && effectiveMode !== SHIPPING_MODES.HOLD,
    },
  };
};
