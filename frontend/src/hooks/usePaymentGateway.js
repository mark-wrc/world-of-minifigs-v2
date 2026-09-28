import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useGetPaymentConfigQuery } from "@/redux/api/paymentApi";
import { setPaymentGateway } from "@/redux/slices/paymentSlice";

/**
 * The gateway checkout will use: the buyer's pick while the server still
 * offers it, otherwise the server's default.
 */
export const usePaymentGateway = () => {
  const dispatch = useDispatch();
  const selected = useSelector((state) => state.payment.gateway);
  const { data } = useGetPaymentConfigQuery();

  const gateways = data?.gateways ?? [];
  const gateway = gateways.includes(selected)
    ? selected
    : (data?.defaultGateway ?? "stripe");

  const setGateway = useCallback(
    (value) => dispatch(setPaymentGateway(value)),
    [dispatch],
  );

  return { gateway, gateways, setGateway };
};
