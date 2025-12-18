import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useGetCurrentUserQuery } from "@/redux/api/authApi";
import { setCredentials, clearCredentials, setLoading } from "@/redux/slices/authSlice";

export const useAuthInit = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  
  // Skip query if user is already in Redux (just logged in)
  const { data, isLoading, error, isError } = useGetCurrentUserQuery(undefined, {
    skip: !!user, // Skip if user already exists in Redux
  });

  useEffect(() => {
    if (isLoading) {
      dispatch(setLoading(true));
      return;
    }

    dispatch(setLoading(false));

    if (isError || error || !data?.success || !data?.user) {
      // Only clear credentials if we don't have a user in Redux
      // This prevents clearing credentials right after login
      if (!user) {
        dispatch(clearCredentials());
      }
    } else if (data?.success && data?.user) {
      dispatch(setCredentials(data.user));
    }
  }, [data, isLoading, error, isError, dispatch, user]);

  return { isLoading };
};

