import {
  Boxes,
  Sparkles,
  Star,
  Zap,
  MousePointerClick,
  Handbag,
  Shirt,
  Truck,
  CircleUser,
  Crown,
  Footprints,
  Origami,
  TrendingUp,
} from "lucide-react";
import dealerVideo from "@/assets/media/dealer.mp4";

export const dealerHero = {
  title: "Build a Minifig",
  highlight: "Parts",
  description: "Get 100% Genuine LEGO Parts. Minimum Dupes, Maximum Variety!",
};

export const dealerFeatures = [
  {
    icon: Boxes,
    label: "Bulk Pricing",
  },
  {
    icon: Sparkles,
    label: "Low Duplicates",
  },
  {
    icon: Star,
    label: "Premium Torsos",
  },
  {
    icon: Zap,
    label: "Fast Shipping",
  },
];

export const dealerProcess = {
  badge: "EASY PROCESS",
  title: "How it Works",
  steps: [
    {
      title: "Select Your Bag Quantity",
      description:
        " Choose up to 1000+ top-quality, 100% genuine LEGO minifigures",
      icon: MousePointerClick,
    },
    {
      title: "Select your add-ons",
      description:
        "Add a specific number of extra minifig part bags and select premium parts",
      icon: Handbag,
    },
    {
      title: "Select your Torso Bag",
      description:
        "Expand your collection with our selection of premium pre-selected torso bags",
      icon: Shirt,
    },
    {
      title: "Payment and Delivery",
      description:
        "Pay securely, ship fast — your bulk minifig parts are packed and on the way in no time",
      icon: Truck,
    },
  ],
};

export const dealerIncluded = {
  badge: "PARTS BREAKDOWN",
  title: "What's Included per Minifig",
  description: "Each minifig in your order includes these 4 essential parts",
  items: [
    {
      title: "1 - Torso",
      description: "Exciting Range of Premium Designs",
      icon: Shirt,
    },
    {
      title: "1 - Head",
      description: "Minimum of 20% flesh-tone minifig heads",
      icon: CircleUser,
    },
    {
      title: "1 - Hair / Headgear",
      description:
        "Carefully curated with a 20% flesh-tone minimum and perfect gender balance.",
      icon: Crown,
    },
    {
      title: "1 - Pair of Legs",
      description: " Exclusive handpicked blend",
      icon: Footprints,
    },
  ],
};

export const dealerBenefits = {
  badge: "DEALER EXCLUSIVE",
  title: "Why Partner with Us",
  description:
    "We offer the highest quality LEGO parts and the most reliable service in the industry",
  features: [
    {
      title: "Premium Quality",
      description:
        "Every piece is meticulously sorted and 100% authentic LEGO—no fakes or knock-offs",
      icon: Star,
    },
    {
      title: "Market Ready",
      description:
        "Our parts are brand new and ready for immediate sale. They are all genuine LEGO products",
      icon: TrendingUp,
    },
    {
      title: "Design Variety",
      description:
        "Gain access to exclusive torso designs that bring personality, detail, and uniqueness to every build",
      icon: Origami,
    },
  ],
};

export const dealerCta = {
  title: "Grow Your Shop with",
  highlight: "World of Minifigs",
  description:
    "Join our network of successful LEGO dealers. Get first pick of new arrivals and genuine parts at prices designed to help you succeed",
  buttonText: "Register as Dealer",
  backgroundVideo: dealerVideo,
};
