import React from "react";
import { Toaster } from "@/components/ui/sonner";
import CartSheet from "@/pages/CartSheet";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Router from "@/routes/Router";
import ScrollToTop from "@/components/layout/ScrollToTop";
import { useAuthInit } from "@/hooks/useAuthInit";

const App = () => {
  useAuthInit();

  return (
    <>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen max-w-480 mx-auto">
        <CartSheet />
        <Header />
        <main className="flex-1 pt-24">
          <Router />
        </main>
        <Footer />
      </div>
      <Toaster position="bottom-right" duration={5000} />
    </>
  );
};

export default App;
