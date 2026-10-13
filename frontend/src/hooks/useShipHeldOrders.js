import { useCallback } from "react";
import { useGetHeldOrdersQuery } from "@/redux/api/authApi";
import { useShipHeldOrdersMutation } from "@/redux/api/paymentApi";
import { usePaymentGateway } from "@/hooks/usePaymentGateway";
import { useShippingPlan } from "@/hooks/useShippingPlan";
import { handleApiError } from "@/utils/apiHelpers";
import { formatCurrency } from "@/utils/formatting";
import {
  computeShippingInsurance,
  getShippingCountry,
} from "@shared/shippingData";

/**
 * Held orders (Pay Now, Ship Later) and the "Ship all now" action — a
 * shipping-only checkout for one flat fee.
 */
const useShipHeldOrders = () => {
  const { gateway } = usePaymentGateway();
  // Optional 0.5% insurance on every held order in the parcel.
  const { insurance } = useShippingPlan();
  const { data, isLoading } = useGetHeldOrdersQuery();
  const [shipHeldOrders, { isLoading: isShipping }] =
    useShipHeldOrdersMutation();

  const count = data?.count ?? 0;

  const shipAll = useCallback(async () => {
    try {
      const res = await shipHeldOrders({
        gateway,
        shippingInsurance: insurance,
      }).unwrap();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        handleApiError(
          null,
          "Checkout failed",
          "Could not start the shipping checkout, please try again",
        );
      }
    } catch (err) {
      handleApiError(err, "Checkout failed", "Please try again");
    }
  }, [gateway, insurance, shipHeldOrders]);

  const insuranceAmount = insurance
    ? computeShippingInsurance(data?.itemsSubtotal)
    : 0;

  return {
    count,
    orders: data?.orders ?? [],
    hasHeldOrders: count > 0,
    mixedCountries: Boolean(data?.mixedCountries),
    destination: getShippingCountry(data?.country)?.label || null,
    shippingRate: formatCurrency(data?.shippingRate),
    // Insurance line for the breakdown — null until it's ticked.
    insuranceAmount:
      insuranceAmount > 0 ? formatCurrency(insuranceAmount) : null,
    // What "Ship all now" charges: the flat rate plus insurance if ticked.
    shipTotal: formatCurrency((data?.shippingRate || 0) + insuranceAmount),
    shippingSaved: data?.shippingSaved > 0 ? formatCurrency(data.shippingSaved) : null,
    shipAll,
    isShipping,
    isLoading,
  };
};

export default useShipHeldOrders;
