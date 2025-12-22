import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { Badge } from "@/components/ui/badge";
import TableLayout from "@/components/table/TableLayout";
import { TableCell } from "@/components/table/BaseColumn";
import { useGetUsersQuery } from "@/redux/api/adminApi";

const UserManagement = () => {
  const { user: currentUser } = useSelector((state) => state.auth);
  const { data: usersData, isLoading: isLoadingUsers } = useGetUsersQuery();

  // Sort users: current admin first, then others
  const sortedUsers = useMemo(() => {
    if (!usersData?.users || !currentUser) return [];

    const users = [...usersData.users];
    const currentUserId = currentUser._id || currentUser.id;

    const currentUserIndex = users.findIndex((user) => {
      const userId = user._id || user.id;
      return userId === currentUserId;
    });

    if (currentUserIndex > -1) {
      const [adminUser] = users.splice(currentUserIndex, 1);
      return [adminUser, ...users];
    }

    return users;
  }, [usersData, currentUser]);

  // Calculate total items
  const totalItems = usersData?.count || sortedUsers.length || 0;

  // Column definitions
  const columns = [
    { key: "user", label: "User" },
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    { key: "contactNumber", label: "Contact" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status" },
    { key: "verified", label: "Verified" },
    { key: "createdAt", label: "Joined" },
  ];

  const isCurrentUser = (user) => {
    const currentUserId = currentUser?._id || currentUser?.id;
    const userId = user._id || user.id;
    return userId === currentUserId;
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "seller":
        return "default";
      case "customer":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-sm text-popover-foreground/80 mt-2">
            View and manage all registered users
          </p>
        </div>
      </div>

      <TableLayout
        searchPlaceholder="Search users..."
        totalItems={totalItems}
        columns={columns}
        data={sortedUsers}
        isLoading={isLoadingUsers}
        loadingMessage="Loading users..."
        emptyMessage="No users found..."
        searchFields={["firstName", "lastName", "username", "email", "role"]}
        renderRow={(user) => (
          <>
            {/* User (Avatar + Name) */}
            <TableCell maxWidth="250px">
              <div className="flex flex-col">
                <span className="font-medium">
                  {user.firstName} {user.lastName}{" "}
                  {isCurrentUser(user) && (
                    <Badge variant="accent" className="w-fit mt-1">
                      You
                    </Badge>
                  )}
                </span>
              </div>
            </TableCell>

            {/* Username */}
            <TableCell maxWidth="150px">@{user.username}</TableCell>

            {/* Email */}
            <TableCell maxWidth="200px">{user.email}</TableCell>

            {/* Contact Number */}
            <TableCell maxWidth="150px">{user.contactNumber || "-"}</TableCell>

            {/* Role */}
            <TableCell>
              <Badge variant={getRoleBadgeVariant(user.role)}>
                {user.role}
              </Badge>
            </TableCell>

            {/* Status */}
            <TableCell>
              <Badge variant={user.isActive ? "accent" : "default"}>
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>

            {/* Verified */}
            <TableCell>
              <Badge variant={user.isVerified ? "accent" : "default"}>
                {user.isVerified ? "Verified" : "Unverified"}
              </Badge>
            </TableCell>

            {/* Joined Date */}
            <TableCell>
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "-"}
            </TableCell>
          </>
        )}
      />
    </div>
  );
};

export default UserManagement;
