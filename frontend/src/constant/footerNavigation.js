import { Facebook, Instagram } from "lucide-react";

export const footerNavigation = [
  {
    id: 1,
    title: "Account",
    links: [
      { label: "My Account", path: "/my-account" },
      { label: "Cart", path: "/cart" },
      { label: "Contact Us", path: "/contact-us" },
    ],
  },
  {
    id: 2,
    title: "Quick Links",
    links: [
      { label: "Products", path: "/products" },
      { label: "About", path: "/about" },
      { label: "Designer", path: "/designer" },
      { label: "Privacy Policy", path: "/privacy-policy" },
      { label: "Terms Of Use", path: "/terms-of-use" },
    ],
  },
  {
    id: 3,
    title: "Support",
    links: [
      { label: "Lehi, Utah 84043"},
      {
        label: "brickextremeofficial@gmail.com",
        path: "mailto:brickextremeofficial@gmail.com",
      },
    ],
  },
  {
    id: 4,
    title: "World of Minifigs",
    description:
      "Follow us on social media to stay updated on new releases, exclusive promotions, and our latest collections.",
    isSocial: true,
    links: [
      {
        id: "facebook",
        icon: Facebook,
        href: "https://www.facebook.com/profile.php?id=61552234252330",
        label: "Facebook",
      },
      {
        id: "instagram",
        icon: Instagram,
        href: "https://www.instagram.com/theworldofminifigs/",
        label: "Instagram",
      },
    ],
  },
];
