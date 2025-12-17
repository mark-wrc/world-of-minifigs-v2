import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useGetCurrentUserQuery } from "@/redux/api/authApi";
import { setCredentials, clearCredentials, setLoading } from "@/redux/slices/authSlice";

export const useAuthInit = () => {
  const dispatch = useDispatch();
  const { data, isLoading, error, isError } = useGetCurrentUserQuery();

  useEffect(() => {
    if (isLoading) {
      dispatch(setLoading(true));
      return;
    }

    dispatch(setLoading(false));

    if (isError || error || !data?.success || !data?.user) {
      dispatch(clearCredentials());
    } else if (data?.success && data?.user) {
      dispatch(setCredentials(data.user));
    }
  }, [data, isLoading, error, isError, dispatch]);

  return { isLoading };
};

