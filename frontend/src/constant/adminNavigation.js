import {
  LayoutDashboard,
  Package,
  Palette,
  ChartColumnStacked,
  FolderKanban,
  Gem,
  Gauge,
  PenTool,
  ShoppingCart,
  Users,
  Handshake,
  Image,
  ChartCandlestick,
} from "lucide-react";

export const adminNavigation = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "banners",
    label: "Banners",
    path: "banners",
    icon: Image,
  },
  {
    id: "products",
    label: "Products",
    path: "products",
    icon: Package,
  },
  {
    id: "general-inventory",
    label: "General Inventory",
    path: "general-inventory",
    icon: ChartCandlestick,
  },
  {
    id: "product-color",
    label: "Product Color",
    path: "product-color",
    icon: Palette,
  },
  {
    id: "categories",
    label: "Categories",
    icon: ChartColumnStacked,
    children: [
      {
        id: "all-categories",
        label: "All Categories",
        path: "categories",
      },
      {
        id: "sub-categories",
        label: "Sub Categories",
        path: "sub-categories",
      },
    ],
  },
  {
    id: "collections",
    label: "Collections",
    icon: FolderKanban,
    children: [
      {
        id: "all-collections",
        label: "All Collections",
        path: "collections",
      },
      {
        id: "sub-collections",
        label: "Sub Collections",
        path: "sub-collections",
      },
    ],
  },
  {
    id: "dealer-management",
    label: "Dealer",
    icon: Handshake,
    children: [
      {
        id: "dealer-bundles",
        label: "Dealer Bundles",
        path: "dealer-bundles",
      },
      {
        id: "dealer-addons",
        label: "Dealer Add-ons",
        path: "dealer-addons",
      },
      {
        id: "dealer-extra-bags",
        label: "Extra Bags",
        path: "dealer-extra-bags",
      },
      {
        id: "dealer-torso-bags",
        label: "Torso Bags",
        path: "dealer-torso-bags",
      },
    ],
  },
  // {
  //   id: "reward-program",
  //   label: "Reward Program",
  //   icon: Gem,
  //   children: [
  //     {
  //       id: "reward-bundles",
  //       label: "Reward Bundles",
  //       path: "reward-bundles",
  //     },
  //     {
  //       id: "reward-addons",
  //       label: "Reward Add-ons",
  //       path: "reward-addons",
  //     },
  //   ],
  // },
  {
    id: "skill-level",
    label: "Skill Level",
    path: "skill-level",
    icon: Gauge,
  },
  {
    id: "designers",
    label: "Designers",
    path: "designers",
    icon: PenTool,
  },
  {
    id: "orders",
    label: "Orders",
    path: "orders",
    icon: ShoppingCart,
  },
  {
    id: "users",
    label: "Users",
    path: "users",
    icon: Users,
  },
];

// import {
//   LayoutDashboard,
//   Package,
//   Palette,
//   ChartColumnStacked,
//   FolderKanban,
//   Gem,
//   Gauge,
//   PenTool,
//   ShoppingCart,
//   Users,
//   Handshake,
//   Image,
//   Settings2,
//   Layers,
//   SquareStack,
// } from "lucide-react";

// export const adminNavigation = [
//   {
//     id: "dashboard",
//     label: "Dashboard",
//     path: "dashboard",
//     icon: LayoutDashboard,
//   },
//   {
//     id: "banners",
//     label: "Banners",
//     path: "banners",
//     icon: Image,
//   },
//   {
//     id: "products",
//     label: "Products",
//     path: "products",
//     icon: Package,
//   },
//   {
//     id: "dealer-management",
//     label: "Dealer",
//     icon: Handshake,
//     children: [
//       {
//         id: "dealer-bundles",
//         label: "Dealer Bundles",
//         path: "dealer-bundles",
//       },
//       {
//         id: "dealer-addons",
//         label: "Dealer Add-ons",
//         path: "dealer-addons",
//       },
//       {
//         id: "dealer-extra-bags",
//         label: "Extra Bags",
//         path: "dealer-extra-bags",
//       },
//       {
//         id: "dealer-torso-bags",
//         label: "Torso Bags",
//         path: "dealer-torso-bags",
//       },
//     ],
//   },
//   {
//     id: "reward-program",
//     label: "Reward Program",
//     icon: Gem,
//     children: [
//       {
//         id: "reward-bundles",
//         label: "Reward Bundles",
//         path: "reward-bundles",
//       },
//       {
//         id: "reward-addons",
//         label: "Reward Add-ons",
//         path: "reward-addons",
//       },
//     ],
//   },
//   {
//     id: "orders",
//     label: "Orders",
//     path: "orders",
//     icon: ShoppingCart,
//   },
//   {
//     id: "users",
//     label: "Users",
//     path: "users",
//     icon: Users,
//   },
//   // {
//   //   id: "designers",
//   //   label: "Designers",
//   //   path: "designers",
//   //   icon: PenTool,
//   // },
//   {
//     id: "product-settings",
//     label: "Product Settings",
//     icon: Settings2,
//     children: [
//       {
//         id: "categories",
//         label: "Categories",
//         path: "categories",
//         icon: ChartColumnStacked,
//       },
//       {
//         id: "sub-categories",
//         label: "Sub Categories",
//         path: "sub-categories",
//         icon: Layers,
//       },
//       {
//         id: "collections",
//         label: "Collections",
//         path: "collections",
//         icon: FolderKanban,
//       },
//       {
//         id: "sub-collections",
//         label: "Sub Collections",
//         path: "sub-collections",
//         icon: SquareStack,
//       },
//       {
//         id: "product-color",
//         label: "Product Color",
//         path: "product-color",
//         icon: Palette,
//       },
//       {
//         id: "skill-level",
//         label: "Skill Level",
//         path: "skill-level",
//         icon: Gauge,
//       },
//     ],
//   },
// ];
