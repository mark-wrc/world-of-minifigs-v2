import React from "react";
import { Routes, Route } from "react-router-dom";
import RootLayout from "@/routes/RootLayout";
import PublicRoutes from "@/routes/PublicRoutes";
import ScrollToTop from "@/components/layout/ScrollToTop";
import { Toaster } from "@/components/ui/sonner";

const App = () => {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/*" element={<PublicRoutes />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" />
    </>
  );
};

export default App;


