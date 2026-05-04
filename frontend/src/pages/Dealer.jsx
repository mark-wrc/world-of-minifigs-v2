import { ArrowDown } from "lucide-react";
import {
  dealerHero,
  dealerFeatures,
  dealerProcess,
  dealerIncluded,
  dealerBenefits,
} from "@/constant/dealerData";
import PageHero from "@/components/shared/PageHero";
import SectionWithCards from "@/components/shared/SectionWithCards";
import ErrorState from "@/components/shared/ErrorState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import DealerBundle from "@/components/dealer/DealerBundle";
import DealerAddon from "@/components/dealer/DealerAddon";
import DealerExtraBag from "@/components/dealer/DealerExtraBag";
import DealerTorsoBag from "@/components/dealer/DealerTorsoBag";
import DealerOrderSummary from "@/components/dealer/DealerOrderSummary";
import AddonPreviewModal from "@/components/dealer/AddonPreviewModal";
import { useDealer } from "@/hooks/useDealer";

const Dealer = () => {
  const {
    // States & Setters
    setSelectedBundleId,
    handleToggleAddon,

    // Data
    bundles,
    addons,
    extraBags,
    torsoBags,

    // Bundle Type Info
    isCustomBundle,
    multiplier,
    miscQuantity,
    displayItems,

    // Memos
    selectedBundle,
    maxExtraBags,
    totalExtraBags,
    lastSelectedBag,

    // Order Summary
    orderSummary,

    // Bag split info
    bagMultiplier,
    totalAssignedBags,
    remainingBagSlots,

    // Handlers
    handleExtraBagQtyChange,
    handleSelectTorsoBag,
    handleTorsoBagQtyChange,

    // Addon Preview Modal
    addonPreview,

    // Reorder (Admin)
    localItems,
    hasReorderChanges,
    isSavingOrder,
    reorderSensors,
    reorderItemIds,
    handleReorderDragEnd,
    handleSaveReorder,
    handleResetReorder,

    // Checkout
    handleDealerCheckout,
    isCheckoutLoading,

    // Status
    isAdmin,
    isLoading,
    isError,
  } = useDealer();

  if (isLoading) {
    return <LoadingSpinner minHeight="min-h-screen" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load dealer packages"
        description="We're experiencing issues loading dealer packages. Please refresh the page or contact support if the problem persists."
        minHeight="min-h-screen"
      />
    );
  }

  if (!bundles) {
    return (
      <ErrorState
        title="No dealer packages available"
        description="No dealer packages are currently available. Please check back soon!"
        minHeight="min-h-screen"
      />
    );
  }

  return (
    <>
      <PageHero
        bannerPadding="py-20"
        title={dealerHero.title}
        highlight={dealerHero.highlight}
        description={dealerHero.description}
        badge={dealerHero.badge}
        features={dealerFeatures}
        // action={
        //   <Button
        //     variant="accent"
        //     size="lg"
        //     onClick={() =>
        //       document
        //         .getElementById("dealer-bundles")
        //         ?.scrollIntoView({ behavior: "smooth", block: "start" })
        //     }
        //     className="group relative overflow-hidden h-12 px-7 uppercase font-semibold tracking-wide before:content-[''] before:absolute before:top-0 before:left-0 before:h-full before:w-1/2 before:-translate-x-full before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent before:skew-x-12 before:transition-transform before:duration-700 hover:before:translate-x-[300%]"
        //   >
        //     Skip to bundles
        //     <ArrowDown className="transition-transform duration-300 group-hover:translate-y-1 motion-safe:animate-bounce" />
        //   </Button>
        // }
      />

      {/* How it works */}
      {/* <SectionWithCards
        badge={dealerProcess.badge}
        title={dealerProcess.title}
        items={dealerProcess.steps}
        gridCols="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      /> */}

      {/* Parts Breakdown */}
      {/* <SectionWithCards
        badge={dealerIncluded.badge}
        title={dealerIncluded.title}
        description={dealerIncluded.description}
        items={dealerIncluded.items}
        gridCols="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        background={true}
      /> */}

      {/* Why Partner with Us */}
      {/* <SectionWithCards
        badge={dealerBenefits.badge}
        title={dealerBenefits.title}
        description={dealerBenefits.description}
        items={dealerBenefits.features}
      /> */}

      <div id="dealer-bundles" className="scroll-mt-20">
        <DealerBundle bundles={bundles} onSelect={setSelectedBundleId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 p-5 items-start overflow-visible bg-input/50 dark:bg-card/50">
        <div className="space-y-10 overflow-visible">
          <DealerAddon
            addons={addons}
            onSelect={handleToggleAddon}
            onPreview={addonPreview.onOpen}
          />

          <DealerExtraBag
            extraBags={extraBags}
            totalExtraBags={totalExtraBags}
            maxExtraBags={maxExtraBags}
            selectedBundle={selectedBundle}
            onQtyChange={handleExtraBagQtyChange}
          />

          <DealerTorsoBag
            torsoBags={torsoBags}
            lastSelectedBag={lastSelectedBag}
            onSelect={handleSelectTorsoBag}
            isAdmin={isAdmin}
            isCustomBundle={isCustomBundle}
            multiplier={multiplier}
            bagMultiplier={bagMultiplier}
            miscQuantity={miscQuantity}
            displayItems={displayItems}
            localItems={localItems}
            hasReorderChanges={hasReorderChanges}
            isSavingOrder={isSavingOrder}
            reorderSensors={reorderSensors}
            reorderItemIds={reorderItemIds}
            onDragEnd={handleReorderDragEnd}
            onSave={handleSaveReorder}
            onReset={handleResetReorder}
          />
        </div>

        <DealerOrderSummary
          selectedBundle={selectedBundle}
          {...orderSummary}
          onCheckout={handleDealerCheckout}
          isCheckoutLoading={isCheckoutLoading}
          bagMultiplier={bagMultiplier}
          totalAssignedBags={totalAssignedBags}
          remainingBagSlots={remainingBagSlots}
          onSetTorsoBagQuantity={handleTorsoBagQtyChange}
          allTorsoBags={torsoBags}
        />
      </div>

      {addonPreview.addon && (
        <AddonPreviewModal
          addon={addonPreview.addon}
          items={addonPreview.items}
          totalBags={addonPreview.totalBags}
          totalPrice={addonPreview.totalPrice}
          canSubmit={addonPreview.canSubmit}
          isUpdate={addonPreview.isUpdate}
          onClose={addonPreview.onClose}
          onConfirm={addonPreview.onConfirm}
          onValueChange={addonPreview.onValueChange}
        />
      )}
    </>
  );
};

export default Dealer;
