import React from "react";
import HighlightText from "@/components/shared/HighlightText";

const BannerPreview = ({ formData }) => {
  const isDarkTheme = formData.textTheme === "dark";
  const isLightTheme = formData.textTheme === "light";

  const getPositionClasses = (position) => {
    switch (position) {
      case "bottom-left":
        return {
          container: "items-end justify-start text-left",
          buttons: "justify-start",
        };
      case "bottom-right":
        return {
          container: "items-end justify-end text-right",
          buttons: "justify-end",
        };
      default:
        return {
          container: "items-center justify-center text-center",
          buttons: "justify-center",
        };
    }
  };

  const layoutClasses = getPositionClasses(formData.position);
  const { container, buttons } = layoutClasses;

  const getButtonStyle = (btn) => {
    if (btn.variant === "outline") return "border";

    return isDarkTheme
      ? "bg-black border-black text-white"
      : "bg-white border-white text-black";
  };

  return (
    <>
      {/* Overlay Content */}
      <div
        className={`absolute inset-0 z-10 pointer-events-none flex h-full w-full p-5 transition-all duration-300 ${container} ${
          isDarkTheme
            ? "text-foreground dark:text-secondary-foreground"
            : "text-background dark:text-foreground"
        }`}
      >
        <div className="max-w-3xl space-y-2">
          {formData.badge && (
            <p className="uppercase tracking-widest text-xs">
              <HighlightText text={formData.badge} />
            </p>
          )}

          {formData.label && (
            <h3 className="text-xl sm:text-2xl font-extrabold uppercase">
              <HighlightText text={formData.label} />
            </h3>
          )}

          {formData.description && (
            <p className="text-xs line-clamp-2">
              <HighlightText text={formData.description} />
            </p>
          )}

          {formData.enableButtons && formData.buttons?.some((b) => b.label) && (
            <div className={`flex gap-2 pt-2 ${buttons}`}>
              {formData.buttons
                .filter((b) => b.label)
                .map((btn, i) => (
                  <div
                    key={i}
                    className={`px-4 py-2 text-[8px] font-bold uppercase border pointer-events-none ${getButtonStyle(
                      btn,
                    )}`}
                  >
                    {btn.label}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Dark Overlay */}
      {isLightTheme && <div className="absolute inset-0 bg-black/20 z-0" />}
    </>
  );
};

export default BannerPreview;
