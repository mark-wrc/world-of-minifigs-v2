import Home from "@/pages/Home";
import Products from "@/pages/Products";
import ProductDetails from "@/pages/ProductDetails";
import Collections from "@/pages/Collections";
import SubCollections from "@/pages/SubCollections";
import Contact from "@/pages/Contact";
import About from "@/pages/About";
import Designer from "@/pages/Designer";
import Dealer from "@/pages/Dealer";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfUse from "@/pages/TermsOfUse";
import VerifyEmail from "@/components/auth/VerifyEmail";
import ResetPassword from "@/components/auth/ResetPassword";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import NotFound from "@/components/layout/NotFound";
import Profile from "@/pages/Profile";
import Purchase from "@/pages/Purchase";
import AdminPanel from "@/pages/AdminPanel";
import Dashboard from "@/pages/admin/Dashboard";
import BannerManagement from "@/pages/admin/banner/BannerManagement";
import ProductManagement from "@/pages/admin/ProductManagement";
import ColorManagement from "@/pages/admin/ColorManagement";
import CategoryManagement from "@/pages/admin/categories/CategoryManagement";
import SubCategoryManagement from "@/pages/admin/categories/SubCategoryManagement";
import CollectionManagement from "@/pages/admin/collections/CollectionManagement";
import SubCollectionManagement from "@/pages/admin/collections/SubCollectionManagement";
import DealerBundleManagement from "@/pages/admin/dealer/DealerBundleManagement";
import DealerAddonManagement from "@/pages/admin/dealer/DealerAddonManagement";
import DealerExtraBagManagement from "@/pages/admin/dealer/DealerExtraBagManagement";
import DealerTorsoBagManagement from "@/pages/admin/dealer/DealerTorsoBagManagement";
import RewardBundleManagement from "@/pages/admin/rewards/RewardBundleManagement";
import RewardAddonManagement from "@/pages/admin/rewards/RewardAddonManagement";
import SkillLevelManagement from "@/pages/admin/SkillLevelManagement";
import DesignerManagement from "@/pages/admin/DesignerManagement";
import OrderManagement from "@/pages/admin/OrderManagement";
import UserManagement from "@/pages/admin/UserManagement";
import GeneralInventoryManagement from "@/pages/admin/GeneralInventoryManagement";
import FlashSaleManagement from "@/pages/admin/FlashSaleManagement";

// Public routes
export const publicRoutes = [
  {
    path: "/",
    element: Home,
  },
  {
    path: "/products",
    element: Products,
  },
  {
    path: "/products/:id",
    element: ProductDetails,
  },
  {
    path: "/collections",
    element: Collections,
  },
  {
    path: "/collections/:collectionId",
    element: SubCollections,
  },
  {
    path: "/contact-us",
    element: Contact,
  },
  {
    path: "/about",
    element: About,
  },
  // {
  //   path: "/designer",
  //   element: Designer,
  // },
  {
    path: "/privacy-policy",
    element: PrivacyPolicy,
  },
  {
    path: "/terms-of-use",
    element: TermsOfUse,
  },
  {
    path: "/verify-email",
    element: VerifyEmail,
  },
  {
    path: "/reset-password",
    element: ResetPassword,
  },
  {
    path: "/checkout/success",
    element: CheckoutSuccess,
  },
];

// Private routes (non-admin)
export const privateRoutes = [
  { path: "/purchase", element: Purchase },
  { path: "/profile", element: Profile },
  {
    path: "/dealers",
    element: Dealer,
    requiredRoles: ["dealer", "admin"],
  },
  {
    // Wholesale reuses the dealer experience — same components, same data,
    // same stock pool. The page reads the channel from the path.
    path: "/wholesalers",
    element: Dealer,
    requiredRoles: ["wholesaler", "admin"],
  },
];

// Admin routes
export const adminRoutes = [
  {
    path: "/admin",
    element: AdminPanel,
    requiredRole: "admin",
    children: [
      {
        path: "dashboard",
        element: Dashboard,
      },
      {
        path: "banners",
        element: BannerManagement,
      },
      {
        path: "products",
        element: ProductManagement,
      },
      {
        path: "product-color",
        element: ColorManagement,
      },
      {
        path: "categories",
        element: CategoryManagement,
      },
      {
        path: "sub-categories",
        element: SubCategoryManagement,
      },
      {
        path: "collections",
        element: CollectionManagement,
      },
      {
        path: "sub-collections",
        element: SubCollectionManagement,
      },
      {
        path: "skill-level",
        element: SkillLevelManagement,
      },
      {
        path: "dealer-bundles",
        element: DealerBundleManagement,
      },
      {
        path: "dealer-addons",
        element: DealerAddonManagement,
      },
      {
        path: "dealer-extra-bags",
        element: DealerExtraBagManagement,
      },
      {
        path: "dealer-torso-bags",
        element: DealerTorsoBagManagement,
      },
      {
        path: "reward-bundles",
        element: RewardBundleManagement,
      },
      {
        path: "reward-addons",
        element: RewardAddonManagement,
      },
      {
        path: "designers",
        element: DesignerManagement,
      },
      {
        path: "orders",
        element: OrderManagement,
      },
      {
        path: "users",
        element: UserManagement,
      },
      {
        path: "general-inventory",
        element: GeneralInventoryManagement,
      },
      {
        path: "flash-sales",
        element: FlashSaleManagement,
      },
    ],
  },
];

// 404 route
export const notFoundRoute = {
  path: "*",
  element: NotFound,
};
