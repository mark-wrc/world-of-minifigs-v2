import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CommonImage from "@/components/shared/CommonImage";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import ErrorState from "@/components/shared/ErrorState";
import {
  AddToCartButton,
  CheckoutButton,
} from "@/components/shared/OrderActionButton";
import QuantityControl from "@/components/shared/QuantityControl";
import ShippingCountrySelect from "@/components/shared/ShippingCountrySelect";
import RelatedProducts from "@/components/products/RelatedProducts";
import { useProductDetails } from "@/hooks/useProductDetails";
import { formatCurrency } from "@/utils/formatting";
import { useProductCheckout } from "@/hooks/useCart";

const ProductDetails = () => {
  const { id } = useParams();

  const {
    product,
    isLoading,
    isError,
    allImages,
    currentImageUrl,
    features,
    colorVariants,
    selectedVariantIndex,
    thumbnailScrollRef,
    displayPrice,
    hasDiscount,
    stockAlert,
    currentPartId,
    hasPartId,
    currentItemId,
    hasItemId,
    descriptions,
    hasDescriptions,
    hasMultipleImages,
    hasFeatures,
    hasColorVariants,
    isThumbnailSelected,
    isColorVariantSelected,
    handleThumbnailClick,
    handlePreviousImage,
    handleNextImage,
    handleColorVariantClick,
    quantity,
    handleQuantityChange,
    maxQuantity,
  } = useProductDetails(id);

  const {
    handleProductCheckout,
    isCheckoutLoading,
    isDisabled: isCheckoutDisabled,
    label: checkoutLabel,
  } = useProductCheckout({
    product,
    variantIndex: selectedVariantIndex,
    quantity,
  });

  if (isLoading) {
    return <LoadingSpinner minHeight="min-h-screen" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load product"
        description="We're experiencing issues loading the product. Please refresh the page or try again later."
        minHeight="min-h-screen"
      />
    );
  }

  if (!product) {
    return (
      <ErrorState
        title="Product not found"
        description="The product you're looking for doesn't exist or has been removed."
        minHeight="min-h-screen"
      />
    );
  }

  return (
    <div className="p-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column - Images */}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Main Image */}
          <div
            className={`relative border border-border rounded-lg group order-1 lg:order-2 
  aspect-square ${hasMultipleImages ? "max-h-[630px]" : "max-h-[600px]"} w-full flex flex-1 items-center justify-center`}
          >
            <CommonImage
              src={currentImageUrl}
              alt={product.productName}
              objectFit="object-contain"
              className="w-full h-full"
            />

            {/* Discount Badge */}
            {product.discount && (
              <Badge variant="accent" className="absolute top-4 right-4 z-10">
                {product.discount}% OFF
              </Badge>
            )}

            {/* Item ID */}
            {hasItemId && (
              <span className="absolute bottom-2 right-2 z-10 text-sm">
                # {currentItemId}
              </span>
            )}

            {/* Navigation Arrows */}
            {hasMultipleImages && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handlePreviousImage}
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleNextImage}
                >
                  <ChevronRight className="size-5" />
                </Button>
              </>
            )}
          </div>

          {/* Thumbnail Gallery */}
          {hasMultipleImages && (
            <div
              ref={thumbnailScrollRef}
              className="flex lg:flex-col gap-2 overflow-y-auto lg:h-[610px] order-2 lg:order-1"
            >
              {allImages.map((img, index) => (
                <Button
                  key={`${img.url}-${index}`}
                  variant="ghost"
                  onClick={() => handleThumbnailClick(index)}
                  className={`relative w-28 h-28 border-4 transition-all p-0 hover:bg-transparent ${
                    isThumbnailSelected(index)
                      ? "border-accent"
                      : "border-border hover:border-destructive"
                  }`}
                >
                  <CommonImage src={img.url} alt={`Thumbnail ${index + 1}`} />
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Product Details */}
        <div className="flex items-center">
          <div className="space-y-3 w-full">
            {/* Product Name */}
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {product.productName}
                {hasPartId && (
                  <span className="text-sm text-muted-foreground font-normal ml-2">
                    #{currentPartId}
                  </span>
                )}
              </h1>
              {/* Star Rating */}
              <div className="flex items-center gap-1 mb-5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="size-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
                <span className="text-xs text-primary leading-none">(0)</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center gap-2">
              <span className="text-5xl font-bold text-success dark:text-accent">
                {formatCurrency(displayPrice)}
              </span>
              {hasDiscount && product.price && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>

            {/* Stock Alert */}
            {stockAlert && (
              <div className="flex items-center gap-2 relative">
                <span
                  className={`w-2 h-2 rounded-full ${stockAlert.dotColor} animate-ping absolute`}
                />
                <span
                  className={`w-2 h-2 rounded-full ${stockAlert.dotColor}`}
                />
                <span className={`text-sm font-medium ${stockAlert.textColor}`}>
                  {stockAlert.message}
                </span>
              </div>
            )}

            {/* Features & Classifications */}
            {hasFeatures && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  Features & Classifications
                </h3>
                <div className="flex flex-wrap gap-2">
                  {features.categories.map((cat, index) => (
                    <Badge
                      key={`cat-${index}`}
                      variant="outline"
                      className="px-3 py-1"
                    >
                      {cat.name}
                    </Badge>
                  ))}
                  {features.collections.map((col, index) => (
                    <Badge
                      key={`col-${index}`}
                      variant="outline"
                      className="px-3 py-1"
                    >
                      {col.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Minifig Guide and Instructions */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Includes</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <Badge variant="outline" className="px-3 py-1">
                  Minifig Guide and Instructions
                </Badge>
              </div>
            </div>

            {/* Color Variants / Color */}
            {hasColorVariants && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {product.productType === "standalone"
                    ? "Color"
                    : `Color: ${
                        colorVariants[selectedVariantIndex ?? 0]
                          ?.secondaryHexCode
                          ? `${colorVariants[selectedVariantIndex ?? 0]?.colorName} / ${colorVariants[selectedVariantIndex ?? 0]?.secondaryColorName}`
                          : colorVariants[selectedVariantIndex ?? 0]
                              ?.colorName || "Select a color"
                      }`}
                </h3>
                <div className="flex flex-wrap gap-1 items-center">
                  {product.productType === "standalone" ? (
                    // Standalone product - show single or dual color as indicator
                    <div className="flex items-center gap-2">
                      <span
                        className="size-6 rounded-full border-2 border-border"
                        style={
                          colorVariants[0]?.secondaryHexCode
                            ? {
                                background: `linear-gradient(135deg, ${colorVariants[0]?.hexCode || "#ccc"} 50%, ${colorVariants[0]?.secondaryHexCode} 50%)`,
                              }
                            : {
                                backgroundColor:
                                  colorVariants[0]?.hexCode || "#ccc",
                              }
                        }
                      />
                      <span className="text-sm">
                        {colorVariants[0]?.secondaryColorName
                          ? `${colorVariants[0]?.colorName} / ${colorVariants[0]?.secondaryColorName}`
                          : colorVariants[0]?.colorName}
                      </span>
                    </div>
                  ) : (
                    // Variant product - show clickable color options with dual-color support
                    colorVariants.map((variant, index) => (
                      <Button
                        key={variant.colorId}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleColorVariantClick(index)}
                        className={`relative size-6 rounded-full border-2 transition-all p-0 hover:bg-transparent group ${
                          isColorVariantSelected(index)
                            ? "border-accent"
                            : "border-border hover:border-destructive"
                        }`}
                        style={
                          variant.secondaryHexCode
                            ? {
                                background: `linear-gradient(135deg, ${variant.hexCode || "#ccc"} 50%, ${variant.secondaryHexCode} 50%)`,
                              }
                            : {
                                backgroundColor: variant.hexCode || "#ccc",
                              }
                        }
                        title={
                          variant.secondaryColorName
                            ? `${variant.colorName} / ${variant.secondaryColorName}`
                            : variant.colorName
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {hasDescriptions && (
              <div className="space-y-2 text-sm pt-2">
                {descriptions.map((description, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span>{description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-4 gap-2">
                <QuantityControl
                  value={quantity}
                  onChange={handleQuantityChange}
                  min={1}
                  max={maxQuantity}
                  size="lg"
                />
                <AddToCartButton
                  product={product}
                  variantIndex={selectedVariantIndex}
                  quantity={quantity}
                  className="flex-1 h-12 col-span-3"
                />
              </div>
              <ShippingCountrySelect
                disabled={isCheckoutLoading}
                className="mt-1"
              />
              <CheckoutButton
                label={checkoutLabel}
                onClick={handleProductCheckout}
                disabled={isCheckoutDisabled}
                isLoading={isCheckoutLoading}
                className="w-full h-12"
              />
            </div>
          </div>
        </div>
      </div>

      {/* You May Also Like */}
      <RelatedProducts productId={id} product={product} />
    </div>
  );
};

export default ProductDetails;
