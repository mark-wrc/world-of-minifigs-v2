import {
  dealerHero,
  dealerFeatures,
} from "@/constant/dealerData";
import {
  wholesaleHero,
  wholesaleFeatures,
} from "@/constant/wholesaleData";
import PageHero from "@/components/shared/PageHero";
import ErrorState from "@/components/shared/ErrorState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import DealerBundle from "@/components/dealer/DealerBundle";
import DealerAddon from "@/components/dealer/DealerAddon";
import DealerExtraBag from "@/components/dealer/DealerExtraBag";
import DealerTorsoBag from "@/components/dealer/DealerTorsoBag";
import DealerOrderSummary from "@/components/dealer/DealerOrderSummary";
import AddonPreviewModal from "@/components/dealer/AddonPreviewModal";
import UpgradePreviewModal from "@/components/dealer/UpgradePreviewModal";
import { useDealer } from "@/hooks/useDealer";

const Dealer = () => {
  const {
    // Setters
    handleToggleBundle,
    handleToggleAddon,
    handleAddonQtyChange,
    handleRemoveAddonSubItem,

    // Data
    bundles,
    addons,
    extraBags,

    // Torso picker
    activeSection,
    bundleTabs,
    hasSelectedBundles,

    // Memos
    maxExtraBags,
    totalExtraBags,

    // Order Summary
    orderSummary,

    // Handlers
    handleExtraBagQtyChange,
    handleSelectTorsoBag,
    handleTorsoBagQtyChange,
    handleBundleQtyChange,
    handleSetActiveBundle,
    handleToggleInsurance,

    // Addon Preview Modal
    addonPreview,

    // Checkout
    handleDealerCheckout,
    isCheckoutLoading,

    // Status
    isAdmin,
    isLoading,
    isError,

    // Channel
    channel,
  } = useDealer();

  const isWholesale = channel === "wholesale";
  const hero = isWholesale ? wholesaleHero : dealerHero;
  const features = isWholesale ? wholesaleFeatures : dealerFeatures;

  if (isLoading) {
    return <LoadingSpinner minHeight="min-h-screen" />;
  }

  const channelLabel = isWholesale ? "wholesale" : "dealer";

  if (isError) {
    return (
      <ErrorState
        title={`Unable to load ${channelLabel} packages`}
        description={`We're experiencing issues loading ${channelLabel} packages. Please refresh the page or contact support if the problem persists.`}
        minHeight="min-h-screen"
      />
    );
  }

  if (!bundles) {
    return (
      <ErrorState
        title={`No ${channelLabel} packages available`}
        description={`No ${channelLabel} packages are currently available. Please check back soon!`}
        minHeight="min-h-screen"
      />
    );
  }

  return (
    <>
      <PageHero
        bannerPadding="py-20"
        title={hero.title}
        highlight={hero.highlight}
        description={hero.description}
        badge={hero.badge}
        features={features}
      />

      <div id="dealer-bundles" className="scroll-mt-20">
        <DealerBundle bundles={bundles} onSelect={handleToggleBundle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5 p-5 items-start overflow-visible bg-input/50 dark:bg-card/50">
        <div className="space-y-10 overflow-visible">
          <DealerAddon
            addons={addons}
            onSelect={handleToggleAddon}
            onPreview={addonPreview.onOpen}
          />

          {hasSelectedBundles && (
            <DealerExtraBag
              extraBags={extraBags}
              totalExtraBags={totalExtraBags}
              maxExtraBags={maxExtraBags}
              selectedBundle={hasSelectedBundles}
              onQtyChange={handleExtraBagQtyChange}
            />
          )}

          {/* Torso picker — follows the focused bundle. The tab strip
              switches between selected bundles. */}
          {activeSection && (
            <div id="step4" className="space-y-5 overflow-visible">
              {bundleTabs.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {bundleTabs.map((tab) => (
                    <button
                      key={tab.bundleId}
                      type="button"
                      onClick={() => handleSetActiveBundle(tab.bundleId)}
                      className={`px-4 py-2 text-sm font-bold uppercase tracking-wide border transition-colors ${
                        tab.isActive
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-card text-muted-foreground border-border hover:border-accent"
                      }`}
                    >
                      {tab.bundleName}
                      {tab.needsTorso && (
                        <span
                          className="ml-1.5 text-amber-500"
                          title="Torso bags not fully assigned"
                        >
                          ●
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <DealerTorsoBag
                key={activeSection.bundleId}
                section={activeSection}
                isAdmin={isAdmin}
                onSelectTorsoBag={handleSelectTorsoBag}
              />
            </div>
          )}
        </div>

        <DealerOrderSummary
          {...orderSummary}
          onCheckout={handleDealerCheckout}
          isCheckoutLoading={isCheckoutLoading}
          onSetTorsoBagQuantity={handleTorsoBagQtyChange}
          onBundleQtyChange={handleBundleQtyChange}
          onToggleInsurance={handleToggleInsurance}
          onRemoveAddonSubItem={handleRemoveAddonSubItem}
          onAddonQtyChange={handleAddonQtyChange}
          onRemoveBundle={handleToggleBundle}
        />
      </div>

      {addonPreview.addon &&
        (addonPreview.addon.addonType === "upgrade" ? (
          <UpgradePreviewModal
            addon={addonPreview.addon}
            isSelected={addonPreview.addon.isSelected}
            onClose={addonPreview.onClose}
            onConfirm={addonPreview.onUpgradeConfirm}
          />
        ) : (
          <AddonPreviewModal
            addon={addonPreview.addon}
            items={addonPreview.items}
            totalPrice={addonPreview.totalPrice}
            canSubmit={addonPreview.canSubmit}
            isUpdate={addonPreview.isUpdate}
            onClose={addonPreview.onClose}
            onConfirm={addonPreview.onConfirm}
            onValueChange={addonPreview.onValueChange}
          />
        ))}
    </>
  );
};

export default Dealer;
