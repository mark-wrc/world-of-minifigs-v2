import {
  Home,
  ShoppingBag,
  Phone,
  Info,
  LayoutDashboard,
  ShoppingCart,
  UserRound,
  Settings,
  Handshake,
  PenTool,
  Facebook,
  Instagram,
} from "lucide-react";
import {
  APP_NAME,
  SMTP_FROM_EMAIL,
  APP_ADDRESS,
  APP_SOCIAL_LINKS,
} from "@/constant/appConfig";

//---------------------------------------------- BASE LINKS --------------------------------------

const NAV_LINKS = {
  home: { id: "home", label: "Home", path: "/", icon: Home },
  products: {
    id: "products",
    label: "Products",
    path: "/products",
    icon: ShoppingBag,
  },
  contact: {
    id: "contact",
    label: "Contact Us",
    path: "/contact-us",
    icon: Phone,
  },
  about: { id: "about", label: "About", path: "/about", icon: Info },
  //   designer: {
  //     id: "designer",
  //     label: "Designer",
  //     path: "/designer",
  //     icon: PenTool,
  //   },
  dealers: {
    id: "dealers",
    label: "Dealers",
    path: "/dealers",
    icon: Handshake,
  },

  // Account / User
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  purchase: {
    id: "purchase",
    label: "My Purchases",
    path: "/purchase",
    icon: ShoppingCart,
  },
  // profile: {
  //   id: "profile",
  //   label: "Profile",
  //   path: "/profile",
  //   icon: UserRound,
  // },
  settings: {
    id: "settings",
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },

  // Legal / Others
  privacy: { id: "privacy", label: "Privacy Policy", path: "/privacy-policy" },
  terms: { id: "terms", label: "Terms Of Use", path: "/terms-of-use" },
};

// ------------------------------- HEADER NAVIGATION -----------------------------------------
export const headerNavigation = [
  NAV_LINKS.home,
  NAV_LINKS.products,
  NAV_LINKS.about,
  NAV_LINKS.contact,
  NAV_LINKS.designer,
  NAV_LINKS.dealers,
].filter(Boolean);

// ------------------------------- FOOTER NAVIGATION -----------------------------------------
export const footerNavigation = [
  {
    title: "Account",
    links: [NAV_LINKS.purchase, NAV_LINKS.profile, NAV_LINKS.settings].filter(
      Boolean,
    ),
  },
  {
    title: "Quick Links",
    links: [
      NAV_LINKS.products,
      NAV_LINKS.about,
      NAV_LINKS.contact,
      NAV_LINKS.designer,
      NAV_LINKS.dealers,
      NAV_LINKS.privacy,
      NAV_LINKS.terms,
    ].filter(Boolean),
  },
  {
    title: "Support",
    links: [
      { label: APP_ADDRESS },
      {
        label: SMTP_FROM_EMAIL,
        path: `mailto: ${SMTP_FROM_EMAIL}`,
      },
    ],
  },
  {
    title: APP_NAME,
    description:
      "Follow us on social media to stay updated on new releases, exclusive promotions, and our latest collections.",
    isSocial: true,
    links: [
      {
        icon: Facebook,
        path: APP_SOCIAL_LINKS.facebook,
        label: "Facebook",
      },
      {
        icon: Instagram,
        path: APP_SOCIAL_LINKS.instagram,
        label: "Instagram",
      },
    ],
  },
];

// ------------------------------- USER MENU (Dropdown) -----------------------------------------
export const userMenu = [
  NAV_LINKS.dashboard,
  NAV_LINKS.purchase,
  NAV_LINKS.profile,
  NAV_LINKS.settings,
].filter(Boolean);
