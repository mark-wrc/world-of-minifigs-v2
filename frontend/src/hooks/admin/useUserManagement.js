import { useSelector } from "react-redux";
import { useEffect } from "react";
import {
  useGetUsersQuery,
  useUpdateUserRoleMutation,
  useUpdateUserTaxExemptMutation,
} from "@/redux/api/adminApi";
import {
  extractPaginatedData,
  handleApiError,
  handleApiSuccess,
} from "@/utils/apiHelpers";
import { toast } from "sonner";
import useAdminCrud from "@/hooks/admin/useAdminCrud";

const columns = [
  { key: "user", label: "Full Name" },
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "contactNumber", label: "Contact No." },
  { key: "role", label: "Role" },
  { key: "taxExempt", label: "Tax Exempt" },
  { key: "verified", label: "Verified" },
  { key: "createdAt", label: "Joined Date" },
];

const useUserManagement = () => {
  const { user: currentUser } = useSelector((state) => state.auth);

  // ------------------------------- Mutations ------------------------------------
  const [updateUserRole, { isLoading: isUpdatingRole }] =
    useUpdateUserRoleMutation();
  const [updateUserTaxExempt, { isLoading: isUpdatingTaxExempt }] =
    useUpdateUserTaxExemptMutation();

  // ------------------------------- Core CRUD ------------------------------------
  const crud = useAdminCrud({
    initialFormData: {},
    createFn: null,
    updateFn: null,
    deleteFn: null,
    entityName: "user",
  });

  // ------------------------------- Fetch ------------------------------------
  const { data: usersData, isLoading: isLoadingUsers } = useGetUsersQuery({
    page: crud.page,
    limit: crud.limit,
    search: crud.search || undefined,
  });

  const {
    items: users,
    totalItems,
    totalPages,
  } = extractPaginatedData(usersData, "users");

  useEffect(() => {
    crud.setTotalItems(totalItems);
  }, [totalItems]);

  // ------------------------------- Helpers ------------------------------------
  const isCurrentUser = (user) => {
    const currentUserId = currentUser?._id || currentUser?.id;
    const userId = user._id || user.id;
    return userId === currentUserId;
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "dealer":
        return "default";
      case "customer":
        return "secondary";
      default:
        return "outline";
    }
  };

  const canUpdateRole = (user) => user.role !== "admin";

  // ------------------------------- Handlers ------------------------------------
  const handleUpdateRole = async (userId, newRole) => {
    try {
      const response = await updateUserRole({
        id: userId,
        role: newRole,
      }).unwrap();

      if (response.success) {
        handleApiSuccess(response, "User role updated successfully");
      }
    } catch (error) {
      handleApiError(error, "Failed to update user role");
    }
  };

  const handleToggleTaxExempt = async (userId, currentValue) => {
    try {
      const response = await updateUserTaxExempt({
        id: userId,
        isTaxExempt: !currentValue,
      }).unwrap();
      if (response.success) {
        if (response.stripeSyncFailed) {
          toast.warning("Tax exemption saved", {
            description: response.description,
          });
        } else {
          handleApiSuccess(response, "Tax exemption updated");
        }
      }
    } catch (error) {
      handleApiError(error, "Failed to update tax exemption");
    }
  };

  // ------------------------------- Return ------------------------------------
  return {
    ...crud,
    users,
    totalItems,
    totalPages,
    columns,
    isLoadingUsers,
    isUpdatingRole,
    isUpdatingTaxExempt,
    currentUser,
    handleUpdateRole,
    handleToggleTaxExempt,
    isCurrentUser,
    getRoleBadgeVariant,
    canUpdateRole,
  };
};

export default useUserManagement;
