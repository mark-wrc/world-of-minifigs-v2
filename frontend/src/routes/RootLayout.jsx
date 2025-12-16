import React from "react";
import { Outlet } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const RootLayout = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 items-center justify-center">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default RootLayout;
