import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

const ProtectedRoute = ({ children, requiredRole, requiredRoles }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // Check if authentication is required
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Check if specific role(s) is required
  // Support both single role (requiredRole) or multiple roles (requiredRoles array)
  const rolesToCheck = requiredRoles || (requiredRole ? [requiredRole] : []);
  
  if (rolesToCheck.length > 0 && !rolesToCheck.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
