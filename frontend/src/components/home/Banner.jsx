import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import ErrorState from "@/components/shared/ErrorState";
import CommonImage from "@/components/shared/CommonImage";
import HighlightText from "@/components/shared/HighlightText";
import Auth from "@/pages/Auth";
import { useBanner } from "@/hooks/useBanner";

const AUTH_PATH_TABS = {
  "/register": "register",
  "/login": "login",
};

const Banner = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState("login");

  const openAuth = (tab) => {
    setAuthTab(tab);
    setAuthOpen(true);
  };
  const {
    banners,
    isLoading,
    isError,
    hasBanners,
    setApi,
    scrollTo,
    getPaginationIndicatorClass,
    getSlideAnimationState,
    container: containerVariants,
    item: itemVariants,
  } = useBanner();

  if (isLoading) {
    return <LoadingSpinner minHeight="aspect-16/7" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load banner"
        description="We're having trouble displaying the banner. Please refresh the page or check back later."
        minHeight="aspect-16/7"
      />
    );
  }

  if (!hasBanners)
    return (
      <ErrorState
        title="No banners available"
        description="There are no banners to display at this time. Please check back soon!"
        minHeight="aspect-16/7"
      />
    );

  return (
    <section className="relative w-full overflow-hidden -mt-20">
      <Auth
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultTab={authTab}
      />

      {/* Pagination Indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {banners.map((_, index) => (
            <Button
              key={index}
              variant="ghost"
              onClick={() => scrollTo(index)}
              className={`h-2 p-0 rounded-full transition-all duration-300 hover:bg-white/60 ${getPaginationIndicatorClass(index)}`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full h-full"
      >
        <CarouselContent className="h-full">
          {banners.map((banner, index) => (
            <CarouselItem key={banner._id} className="h-full">
              <div className="relative w-full h-full aspect-4/5 md:aspect-16/7">
                {banner.mediaType === "video" ? (
                  <video
                    data-banner-video={index}
                    className="absolute inset-0 w-full h-full object-cover"
                    src={banner.mediaUrl}
                    autoPlay
                    muted
                    playsInline
                  />
                ) : (
                  <CommonImage
                    src={banner.mediaUrl}
                    alt={banner.label || "Banner"}
                    className="absolute inset-0"
                  />
                )}

                {/* Overlay (only when light text is used) */}
                {banner.showOverlay && (
                  <div className="absolute inset-0 bg-black/30" />
                )}

                {/* Content */}
                <div
                  className={
                    "relative z-10 flex h-full w-full px-5 py-12 sm:px-10 " +
                    banner.alignmentClasses +
                    " " +
                    banner.textClass
                  }
                >
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate={getSlideAnimationState(index)}
                    className="max-w-3xl space-y-3"
                  >
                    {banner.badge && (
                      <motion.p
                        variants={itemVariants}
                        className="uppercase tracking-widest text-xs sm:text-sm"
                      >
                        <HighlightText text={banner.badge} />
                      </motion.p>
                    )}

                    {banner.label && (
                      <motion.h1
                        variants={itemVariants}
                        className="text-4xl sm:text-5xl md:text-6xl font-extrabold uppercase"
                      >
                        <HighlightText text={banner.label} />
                      </motion.h1>
                    )}

                    {banner.description && (
                      <motion.p
                        variants={itemVariants}
                        className={
                          "text-sm sm:text-lg" + banner.descriptionClass
                        }
                      >
                        <HighlightText text={banner.description} />
                      </motion.p>
                    )}

                    {banner.showButtons && (
                      <motion.div
                        variants={itemVariants}
                        className={
                          "flex gap-3 pt-5 " + banner.buttonsContainerClass
                        }
                      >
                        {banner.buttons.map((btn, btnIndex) => {
                          const authTabValue = AUTH_PATH_TABS[btn.href];
                          if (authTabValue) {
                            return (
                              <Button
                                key={btnIndex}
                                variant={btn.buttonVariant}
                                className="h-12"
                                onClick={() => openAuth(authTabValue)}
                              >
                                {btn.label}
                              </Button>
                            );
                          }
                          return (
                            <Button
                              key={btnIndex}
                              asChild
                              variant={btn.buttonVariant}
                              className="h-12"
                            >
                              <Link to={btn.href || "#"}>{btn.label}</Link>
                            </Button>
                          );
                        })}
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
};

export default Banner;
