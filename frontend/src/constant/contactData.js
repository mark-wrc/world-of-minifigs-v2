import { Facebook, Instagram, Mail } from "lucide-react";
import { APP_EMAIL, APP_SOCIAL_LINKS } from "@/constant/appConfig";

export const contactHero = {
  title: "Get in Touch",
  highlight: "Touch",
  description:
    "World of Minifigs Team is always open to your suggestions, concerns, and business ideas. Feel free to reach out and we'll surely respond within 24 hours!",
};

export const contactChannels = {
  title: "Let's be connected!",
  description: "Connect with us online",
  channels: [
    {
      id: "facebook",
      icon: Facebook,
      path: APP_SOCIAL_LINKS.facebook,
      label: "Facebook",
      type: "external",
    },
    {
      id: "instagram",
      icon: Instagram,
      path: APP_SOCIAL_LINKS.instagram,
      label: "Instagram",
      type: "external",
    },
    {
      id: "email",
      icon: Mail,
      path: `mailto:${APP_EMAIL}`,
      label: "Email",
      type: "mailto",
    },
  ],
};

export const contactFaqs = {
  title: "Frequently Asked Questions",
  faq: [
    {
      question: "1. Where are you located?",
      answer: "We are located in Lehi, Utah.",
    },
    {
      question: "2. Do you have a physical store?",
      answer:
        "Currently, we are an online-only store. We have stores in Bricklink, eBay, Etsy, and Mercari.",
    },
    {
      question: "3. Are your LEGO parts authentic?",
      answer:
        "Yes, we guarantee that all LEGO parts sold on our website are 100% new and authentic LEGO products. We source our parts from reputable and authorized suppliers.",
    },
    {
      question: "4. How long does shipping take?",
      answer:
        "Shipping times vary depending on your location and the shipping method chosen. We aim to ship orders within 1-2 business days.",
    },
    {
      question:
        "5. Can I request specific LEGO parts that are not listed on your website?",
      answer:
        "While we try to keep a large inventory, we may not have every LEGO part available. Please contact us with your request, and we will do our best to assist you.",
    },
  ],
};
