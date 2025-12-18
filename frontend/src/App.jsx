import React from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Router from "@/routes/Router";
import ScrollToTop from "@/components/layout/ScrollToTop";
import { Toaster } from "@/components/ui/sonner";
import { useAuthInit } from "@/hooks/useAuthInit";

const App = () => {
  useAuthInit();

  return (
    <>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 items-center justify-center">
          <Router />
        </main>
        <Footer />
      </div>
      <Toaster position="bottom-right" />
    </>
  );
};

export default App;


