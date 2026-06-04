import { toast } from "sonner";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\(\d{3}\) \d{3}-\d{4}$/;

// UI-level required field check with toast feedback
export const validateRequired = (value, label, description) => {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed) {
    toast.error(`${label} is required`, {
      description: description || `Please provide a ${label.toLowerCase()}.`,
    });
    return false;
  }
  return true;
};

/** Validates that a value is a positive number (optionally allowing zero or being optional) */
export const validatePositiveNumber = (
  value,
  label,
  { min = 0, required = true } = {},
) => {
  if (!required && (value === undefined || value === null || value === ""))
    return true;
  const num = Number(value);
  if (isNaN(num) || num < min) {
    toast.error(`Valid ${label.toLowerCase()} is required`, {
      description: `Please provide a number that is at least ${min}.`,
    });
    return false;
  }
  return true;
};

/** Validates a required field specifically for a certain mode (e.g. 'add') */
export const validateRequiredInMode = (
  mode,
  targetMode,
  value,
  label,
  description,
) => {
  if (mode === targetMode) {
    return validateRequired(value, label, description);
  }
  return true;
};

// Validate email format
export const validateEmail = (email) => EMAIL_REGEX.test(email.trim());

// Format phone input as (XXX) XXX-XXXX as the user types
export const sanitizePhone = (value) => {
  let digits = value.replace(/\D/g, "");
  // Strip leading +1 or 1 country code
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

// Validate US phone number — must be 10 digits in (XXX) XXX-XXXX format
export const validatePhone = (phone) => PHONE_REGEX.test(phone.trim());

// Get password requirement check results
export const getPasswordRequirements = (password) => ({
  minLength: password.length >= 6,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecialChar: /[!@#$%^&*_]/.test(password),
});

// Check all password requirements pass
export const isPasswordValid = (requirements) =>
  requirements.minLength &&
  requirements.hasUppercase &&
  requirements.hasLowercase &&
  requirements.hasNumber &&
  requirements.hasSpecialChar;

// Show specific toast error for first unmet password requirement
export const showPasswordError = (requirements) => {
  if (!requirements.minLength) {
    toast.error("Password must be at least 6 characters", {
      description:
        "Your password needs to be longer to meet security requirements.",
    });
  } else if (!requirements.hasUppercase) {
    toast.error("Password must contain at least one uppercase letter", {
      description: "Add at least one capital letter (A-Z) to your password.",
    });
  } else if (!requirements.hasLowercase) {
    toast.error("Password must contain at least one lowercase letter", {
      description: "Add at least one lowercase letter (a-z) to your password.",
    });
  } else if (!requirements.hasNumber) {
    toast.error("Password must contain at least one number", {
      description: "Add at least one number (0-9) to your password.",
    });
  } else if (!requirements.hasSpecialChar) {
    toast.error(
      "Password must contain at least one special character (!@#$%^&*_)",
      {
        description:
          "Add at least one special character to strengthen your password.",
      },
    );
  }
};
// validate all banner fields
export const validateBanner = (formData, mode) => {
  if (!validateRequired(formData.label, "Label")) return false;
  if (!validateRequired(formData.description, "Description")) return false;

  if (
    !validateRequiredInMode(
      mode,
      "add",
      formData.media,
      "Banner media",
      "Please upload media for the banner.",
    )
  )
    return false;

  if (formData.enableButtons) {
    const hasValidButton = formData.buttons?.some(
      (b) =>
        (b.label ?? "").toString().trim() && (b.href ?? "").toString().trim(),
    );

    if (!hasValidButton) {
      toast.error("Button configuration incomplete", {
        description:
          "Please provide both label and link for at least one enabled button.",
      });
      return false;
    }
  }

  return true;
};

// validate all product fields
export const validateProduct = (
  formData,
  productType,
  variants,
  imagePreviews,
) => {
  if (!validateRequired(formData.productName, "Product name")) return false;

  if (!validatePositiveNumber(formData.price, "Price", { min: 0.01 }))
    return false;

  // Check descriptions (sanitize all and ensure at least one is valid)
  const validDescriptions = (formData.descriptions || [])
    .map((d) => (d ?? "").toString().trim())
    .filter(Boolean);

  if (validDescriptions.length === 0) {
    toast.error("At least one description is required");
    return false;
  }

  // Check discount relative to price
  if (
    formData.discount &&
    parseFloat(formData.discount) >= parseFloat(formData.price)
  ) {
    toast.error("Discount price must be less than the original price");
    return false;
  }

  // Check optional numeric fields if provided
  const numericFields = [
    { key: "pieceCount", label: "Piece count" },
    { key: "length", label: "Length" },
    { key: "width", label: "Width" },
    { key: "height", label: "Height" },
    { key: "stock", label: "Stock" },
  ];

  for (const { key, label } of numericFields) {
    if (!validatePositiveNumber(formData[key], label, { required: false }))
      return false;
  }

  if (productType === "standalone") {
    if (!validateRequired(formData.itemId, "Item ID")) return false;

    // Check colors are distinct
    if (
      formData.colorId &&
      formData.secondaryColorId &&
      formData.colorId === formData.secondaryColorId
    ) {
      toast.error("Main color and secondary color must be different");
      return false;
    }

    if (!imagePreviews?.length) {
      toast.error("Image is required", {
        description: "Please add at least one product image.",
      });
      return false;
    }
  } else if (productType === "variant") {
    if (!variants?.length) {
      toast.error("At least one variant is required");
      return false;
    }

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (!validateRequired(variant.itemId, `Variant ${i + 1} Item ID`))
        return false;
      if (!validateRequired(variant.colorId, `Variant ${i + 1} Color`))
        return false;

      if (
        variant.colorId &&
        variant.secondaryColorId &&
        variant.colorId === variant.secondaryColorId
      ) {
        toast.error(
          `Variant ${i + 1}: Main and secondary colors must be different`,
        );
        return false;
      }

      if (!variant.image && !variant.imagePreview) {
        toast.error("Variant image is required", {
          description: `Please add an image for Variant ${i + 1}.`,
        });
        return false;
      }
    }
  }

  return true;
};

// validate all collection fields
export const validateCollection = (formData, mode) => {
  if (!validateRequired(formData.collectionName, "Collection name"))
    return false;

  if (
    !validateRequiredInMode(
      mode,
      "add",
      formData.image,
      "Collection image",
      "Please upload an image for the collection.",
    )
  )
    return false;

  return true;
};

// validate all sub-collection fields
export const validateSubCollection = (formData, mode) => {
  if (!validateRequired(formData.subCollectionName, "Sub-collection name"))
    return false;

  if (
    !validateRequired(
      formData.collection,
      "Collection",
      "Please select a collection.",
    )
  )
    return false;

  if (
    !validateRequiredInMode(
      mode,
      "add",
      formData.image,
      "Sub-collection image",
      "Please upload an image for the sub-collection.",
    )
  )
    return false;

  return true;
};

// validate all category fields
export const validateCategory = (formData) => {
  if (!validateRequired(formData.categoryName, "Category name")) return false;
  return true;
};

// validate all sub-category fields
export const validateSubCategory = (formData) => {
  if (!validateRequired(formData.subCategoryName, "Sub-category name"))
    return false;
  if (
    !validateRequired(
      formData.category,
      "Category",
      "Please select a parent category.",
    )
  ) {
    return false;
  }
  return true;
};

// validate all color fields
export const HEX_PATTERN = /^#?[0-9A-F]{6}$/i;
export const validateColor = (formData) => {
  if (!validateRequired(formData.colorName, "Color name")) return false;
  if (!validateRequired(formData.hexCode, "Hex code")) return false;

  const hex = (formData.hexCode ?? "").toString().trim();
  if (!HEX_PATTERN.test(hex)) {
    toast.error("Invalid hex code format", {
      description:
        "Hex code must be in format #RRGGBB or RRGGBB (e.g., #FF5733 or FF5733).",
    });
    return false;
  }
  return true;
};

// validate all dealer bundle fields
export const validateDealerBundle = (formData) => {
  if (!validateRequired(formData.bundleName, "Bundle name")) return false;
  if (!validatePositiveNumber(formData.minifigQuantity, "Quantity", { min: 1 }))
    return false;
  if (!validatePositiveNumber(formData.unitPrice, "Unit price")) return false;
  return true;
};

// validate all dealer extra bag fields
export const validateDealerExtraBag = (formData) => {
  if (!validateRequired(formData.subCollectionId, "Part Type")) return false;
  if (!validatePositiveNumber(formData.price, "Price", { min: 0.01 }))
    return false;
  return true;
};

// validate all reward addon fields
export const validateRewardAddon = (formData) => {
  if (!validateRequired(formData.quantity, "Quantity")) return false;
  return true;
};

// validate all reward bundle fields
export const validateRewardBundle = (formData) => {
  if (!validateRequired(formData.bundleName, "Bundle name")) return false;
  if (!validatePositiveNumber(formData.minifigQuantity, "Quantity", { min: 1 }))
    return false;
  if (!validatePositiveNumber(formData.totalPrice, "Total price")) return false;
  return true;
};

// validate all skill level fields
export const validateSkillLevel = (formData) => {
  if (!validateRequired(formData.skillLevelName, "Skill level name"))
    return false;
  return true;
};

// validate all order status update fields
export const validateOrderStatusUpdate = (state) => {
  const {
    selectedOrder,
    newStatus,
    carrier,
    trackingNumber,
    trackingLink,
    cancelReason,
  } = state;

  if (!selectedOrder) {
    toast.error("Select an order", {
      description: "Please pick an order before updating its status.",
    });
    return false;
  }

  if (!newStatus) {
    toast.error("Choose a status", {
      description: "Select the next status before submitting.",
    });
    return false;
  }

  if (newStatus === "shipped") {
    const sCarrier = (carrier ?? "").toString().trim();
    const sTrackingNumber = (trackingNumber ?? "").toString().trim();
    const sTrackingLink = (trackingLink ?? "").toString().trim();

    if (!sCarrier || !sTrackingNumber || !sTrackingLink) {
      toast.error("Shipping details required", {
        description: "Carrier, tracking number, and link are mandatory.",
      });
      return false;
    }
  }

  if (newStatus === "cancelled") {
    const sReason = (cancelReason ?? "").toString().trim();
    if (!sReason) {
      toast.error("Cancellation reason required", {
        description: "Provide a brief reason before cancelling the order.",
      });
      return false;
    }
  }

  return true;
};

// validate all dealer torso bag fields
export const validateDealerTorsoBag = (
  formData,
  adminTarget,
  targetSize,
  miscQuantity,
) => {
  if (!validateRequired(formData.bagName, "Bag name")) return false;

  if (!formData.items?.length) {
    toast.error("Items are required", {
      description: "Please add at least one torso design.",
    });
    return false;
  }

  const submitTotal = formData.items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 1),
    0,
  );

  if (submitTotal !== adminTarget) {
    toast.error("Quantity mismatch", {
      description: `Total must equal ${adminTarget} (${targetSize} minus ${miscQuantity} misc). Current: ${submitTotal}.`,
    });
    return false;
  }

  return true;
};

// validate all dealer add-on fields
export const validateDealerAddon = (formData, bundleItems = []) => {
  if (!validateRequired(formData.addonName, "Add-on name")) return false;
  if (!validateRequired(formData.addonType, "Add-on type")) return false;

  if (!formData.visibleChannels || formData.visibleChannels.length === 0) {
    toast.error("Channel required", {
      description: "Select at least one channel (Dealer or Wholesale).",
    });
    return false;
  }

  if (formData.addonType === "bundle") {
    if (!bundleItems || bundleItems.length === 0) {
      toast.error("Items are required", {
        description: "Please add at least one inventory item to the bundle.",
      });
      return false;
    }

    // Check for duplicate inventory items
    const itemIds = bundleItems.map((i) => i.inventoryItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      toast.error("Duplicate items found", {
        description: "Each inventory item can only appear once in a bundle.",
      });
      return false;
    }

    for (let i = 0; i < bundleItems.length; i++) {
      if (!bundleItems[i].inventoryItemId) {
        toast.error(`Item ${i + 1}: Inventory item is required`);
        return false;
      }
    }
  }

  if (formData.addonType === "upgrade") {
    if (
      !validatePositiveNumber(formData.price, "Price", {
        min: 0,
        required: false,
      })
    )
      return false;
  }

  return true;
};

// validate all general inventory fields
export const validateGeneralInventory = (items, isAddMode, activeTab) => {
  if (!items || !items.length) {
    toast.error("Items are required", {
      description: "Please add at least one item.",
    });
    return false;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prefix = items.length > 1 ? `Item ${i + 1} ` : "";

    if (isAddMode && !validateRequired(item.minifigName, `${prefix}Name`))
      return false;

    if (
      !validatePositiveNumber(item.pricePerBag, `${prefix}Price per bag`, {
        min: 0.01,
      })
    )
      return false;

    if (
      item.piecesPerBag !== undefined &&
      item.piecesPerBag !== "" &&
      !validatePositiveNumber(item.piecesPerBag, `${prefix}Pieces per bag`, {
        min: 1,
      })
    )
      return false;

    if (
      !validatePositiveNumber(item.stock, `${prefix}Stock (bags)`, { min: 0 })
    )
      return false;

    if (!validateRequired(item.colorId || item.color, `${prefix}Color`))
      return false;

    if (
      activeTab === "minifigs" &&
      !validateRequired(item.collectionId, `${prefix}Collection`)
    )
      return false;

    if (
      activeTab === "bulk-minifig-parts" &&
      !validateRequired(item.partType, `${prefix}Part Type`)
    )
      return false;

    if (isAddMode && !item.image && !item.url) {
      toast.error(`${prefix}Image is required`);
      return false;
    }
  }

  return true;
};

/** Checks if an item can be removed based on a minimum items requirement */
export const validateMinItems = (items, min, label) => {
  if (items.length <= min) {
    toast.error(`At least ${min} ${label.toLowerCase()} is required`);
    return false;
  }
  return true;
};

/** Checks if a torso bag item quantity update fits within the remaining allocation */
export const validateTorsoAllocation = (
  currentOtherItemsTotal,
  newValue,
  adminTarget,
) => {
  if (currentOtherItemsTotal + newValue > adminTarget) {
    toast.error("Allocation limit reached", {
      description: `Total quantity cannot exceed ${adminTarget}.`,
    });
    return false;
  }
  return true;
};

/** Warning for when some files are skipped due to allocation limits */
export const showTorsoAllocationWarning = (
  skippedCount,
  adminTarget,
  targetSize,
  miscQuantity,
) => {
  if (skippedCount > 0) {
    toast.warning(`Limit reached: ${skippedCount} designs were skipped`, {
      description: `Admin allocation target is ${adminTarget} (${targetSize} minus ${miscQuantity} miscellaneous).`,
    });
  }
};

/** Generic toast for file reading failures */
export const handleFileReadError = () => {
  toast.error("Failed to read image file");
};
