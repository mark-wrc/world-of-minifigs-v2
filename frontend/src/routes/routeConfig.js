import Home from "@/pages/Home";
import Products from "@/pages/Products";
import Contact from "@/pages/Contact";
import About from "@/pages/About";
import Designer from "@/pages/Designer";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfUse from "@/pages/TermsOfUse";
import VerifyEmail from "@/components/auth/VerifyEmail";
import ResetPassword from "@/components/auth/ResetPassword";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Purchase from "@/pages/Purchase";

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
    path: "/contact-us",
    element: Contact,
  },
  {
    path: "/about",
    element: About,
  },
  {
    path: "/designer",
    element: Designer,
  },
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
];

// Private routes
export const privateRoutes = [
  {
    path: "/admin/dashboard",
    element: Dashboard,
    requiredRole: "admin",
  },
  {
    path: "/purchase",
    element: Purchase,
  },
  {
    path: "/profile",
    element: Profile,
  },
  {
    path: "/settings",
    element: Settings,
  },
];

// 404 route
export const notFoundRoute = {
  path: "*",
  element: NotFound,
};
