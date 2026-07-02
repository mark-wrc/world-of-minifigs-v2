import React, { useState, useEffect } from "react";
import Logo from "@/assets/media/Logo.png";
import { buildCloudinaryUrl } from "@/utils/cloudinary";

const CommonImage = ({
  src,
  alt,
  className = "",
  imgClassName = "",
  objectFit = "object-cover",
  // When set, request a resized Cloudinary thumbnail (max `thumb` px on the
  // longest side) instead of the full-resolution original. Hugely reduces
  // bytes transferred when many images render at once (e.g. order modals).
  thumb,
  // Native <img> loading strategy. Defaults to "lazy" so off-screen images in
  // long lists don't all download/decode up front.
  loading = "lazy",
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const hasImage = typeof src === "string" && src.trim() !== "" && !hasError;
  const resolvedSrc =
    hasImage && thumb
      ? buildCloudinaryUrl(src, { width: thumb, height: thumb })
      : src;

  return (
    <div className={`overflow-hidden rounded-md ${className}`}>
      {hasImage ? (
        <img
          src={resolvedSrc}
          alt={alt || "Image"}
          className={`w-full h-full ${objectFit} ${imgClassName}`}
          loading={loading}
          decoding="async"
          onError={() => setHasError(true)}
        />
      ) : (
        <img
          src={Logo}
          alt="No image"
          className="w-full h-full object-contain opacity-20 p-2"
        />
      )}
    </div>
  );
};

export default CommonImage;
