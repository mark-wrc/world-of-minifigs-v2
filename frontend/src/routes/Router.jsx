import React from "react";
import { Routes, Route } from "react-router-dom";
import { publicRoutes, privateRoutes, notFoundRoute } from "@/routes/routeConfig";
import ProtectedRoute from "@/routes/ProtectedRoute";

const Router = () => {
  return (
    <Routes>
      {/* Public Routes */}
      {publicRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={<route.element />} />
      ))}

      {/* Private Routes */}
      {privateRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <ProtectedRoute requiredRole={route.requiredRole}>
              <route.element />
            </ProtectedRoute>
          }
        />
      ))}

      {/* 404 Route - must be last */}
      <Route path={notFoundRoute.path} element={<notFoundRoute.element />} />
    </Routes>
  );
};

export default Router;
