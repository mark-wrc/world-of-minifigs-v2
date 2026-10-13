import React from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OrderCard from "@/components/products/OrderCard";
import ShipmentCard from "@/components/products/ShipmentCard";
import HeldOrdersPanel from "@/components/products/HeldOrdersPanel";
import ProductPagination from "@/components/products/ProductPagination";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import ErrorState from "@/components/shared/ErrorState";
import usePurchase from "@/hooks/usePurchase";

const Purchase = () => {
  const {
    orderCards,
    orderTabs,
    activeTab,
    page,
    totalPages,
    pageNumbers,
    isFirstPage,
    isLastPage,
    showPagination,
    handleTabChange,
    handlePageChange,
    isLoading,
    isFetching,
    isError,
  } = usePurchase();

  // ?shipment=<id> (the shipped email's button) opens that shipment's card.
  const [searchParams] = useSearchParams();
  const focusShipmentId = searchParams.get("shipment");

  if (isLoading) {
    return <LoadingSpinner minHeight="min-h-screen" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load orders"
        description="We're experiencing issues loading your orders. Please refresh the page or try again later."
        minHeight="min-h-screen"
      />
    );
  }

  return (
    <div className="px-5 py-10">
      {/* Header */}
      <div className="pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">My Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage your past orders
        </p>
      </div>

      {/* Held orders — ship them all for one flat fee */}
      <HeldOrdersPanel />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {orderTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="px-4">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Single content area for all tabs (query-driven) */}
        {orderTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {isFetching ? (
              <LoadingSpinner />
            ) : orderCards.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <h1 className="text-5xl font-extrabold uppercase">
                  No orders yet!
                </h1>
              </div>
            ) : (
              <div
                className={`mt-5 grid gap-3 items-start ${
                  orderCards.length > 1 ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                {orderCards.map((card) =>
                  card.type === "shipment" ? (
                    <ShipmentCard
                      key={card.key}
                      shipmentCard={card}
                      focused={String(card.key) === focusShipmentId}
                    />
                  ) : (
                    <OrderCard key={card.key} orderCard={card} />
                  ),
                )}

                {showPagination && (
                  <ProductPagination
                    currentPage={page}
                    totalPages={totalPages}
                    pageNumbers={pageNumbers}
                    isFirstPage={isFirstPage}
                    isLastPage={isLastPage}
                    onPreviousPage={() => handlePageChange(page - 1)}
                    onNextPage={() => handlePageChange(page + 1)}
                    onPageNumberClick={handlePageChange}
                  />
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Purchase;
