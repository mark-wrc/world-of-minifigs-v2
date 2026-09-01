import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
// Dark mode is disabled for now — the app is light-themed only.
// import { Search, ShoppingCart, Sun, Moon, Menu } from "lucide-react";
import { Search, ShoppingCart, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import Logo from "@/assets/media/Logo.png";
import { headerNavigation, userMenu } from "@/constant/pageNavigation";
import { APP_NAME } from "@/constant/appConfig";
import GlobalSearch from "@/components/layout/GlobalSearch";
import MobileMenu from "@/components/layout/MobileMenu";
import UserDropdown from "@/components/layout/UserDropdown";
import Auth from "@/pages/Auth";
import Settings from "@/pages/Settings";
// import { useThemeToggle } from "@/hooks/useToggleTheme";
import { useLogout, getInitials } from "@/hooks/useLogin";
import { useBanner } from "@/hooks/useBanner";
import { useCart } from "@/hooks/useCart";

const Header = () => {
  // const { darkMode, toggleDarkMode } = useThemeToggle();
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const location = useLocation();
  const { handleLogout, isLoggingOut } = useLogout();
  const [isScrolled, setIsScrolled] = useState(false);
  const { hasBanners } = useBanner();
  const { totalQuantity, openCart } = useCart();

  // Check if current page is Home
  const isHomePage = location.pathname === "/";

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Filter menu items based on user role
  const filteredUserMenuItems = userMenu.filter((item) => {
    // Show dashboard only for admin
    if (item.id === "dashboard" && user?.role !== "admin") {
      return false;
    }
    return true;
  });

  // Dealer / Wholesaler pages are role-gated to their channel (admin sees both).
  const filteredHeaderNavigation = headerNavigation.filter((item) => {
    if (item.id === "dealers") {
      if (!isAuthenticated) return false;
      return user?.role === "dealer" || user?.role === "admin";
    }
    if (item.id === "wholesalers") {
      if (!isAuthenticated) return false;
      return user?.role === "wholesaler" || user?.role === "admin";
    }
    return true;
  });

  // Get user initials
  const userInitials = getInitials(user);

  // Check if path is active (for mobile menu)
  const isActive = (path) => location.pathname === path;

  // Header dynamic classes
  const headerBaseClasses =
    "fixed top-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-480 flex items-center justify-between px-5 transition-all duration-300";
  const headerTransparentClasses =
    "bg-linear-to-b from-black/60 via-black/50 to-transparent";
  const headerSolidClasses = "bg-popover-foreground dark:bg-input";

  const isTransparent = isHomePage && !isScrolled && hasBanners;

  return (
    <>
      <Auth open={authOpen} onOpenChange={setAuthOpen} />
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <header
        className={`${headerBaseClasses} ${isTransparent ? headerTransparentClasses : headerSolidClasses}`}
      >
        <Link to="/" className="flex items-center">
          <img src={Logo} title={APP_NAME} className="h-20 p-1" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-10">
          {filteredHeaderNavigation.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => {
                const baseNavClasses =
                  "transition-all duration-300 font-medium";
                const activeNavClasses =
                  "text-accent decoration-2 underline underline-offset-8";
                const inactiveTransparentClasses =
                  "text-background dark:text-foreground hover:text-accent dark:hover:text-accent";
                const inactiveSolidClasses =
                  "text-background dark:text-foreground hover:text-accent dark:hover:text-accent";

                return `${baseNavClasses} ${
                  isActive
                    ? activeNavClasses
                    : isTransparent
                      ? inactiveTransparentClasses
                      : inactiveSolidClasses
                }`;
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Header Actions */}
        <div className="flex items-center">
          {/* Search */}
          <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Search"
                title="Search Items"
                className="hover:bg-transparent hover:text-background dark:hover:text-foreground"
              >
                <Search />
              </Button>
            </SheetTrigger>
            <GlobalSearch
              isOpen={searchOpen}
              onClose={() => setSearchOpen(false)}
            />
          </Sheet>
          {/* Cart Button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cart"
            title="View Cart"
            onClick={openCart}
            className="relative hover:bg-transparent hover:text-background dark:hover:text-foreground mr-3"
          >
            <ShoppingCart />
            {totalQuantity > 0 && (
              <span className="absolute bottom-4 left-5 flex size-4 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground dark:text-secondary-foreground">
                {totalQuantity}
              </span>
            )}
          </Button>
          {/* Theme Toggle Button — hidden while the app is light-theme only */}
          {/* <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            aria-label="Toggle theme"
            title={darkMode ? "Toggle Light mode" : "Toggle Dark mode"}
            className="hover:bg-transparent hover:text-background dark:hover:text-foreground"
          >
            {darkMode ? <Sun /> : <Moon />}
          </Button> */}
          {/* User Dropdown or Sign In Button */}
          {isAuthenticated ? (
            <UserDropdown
              user={user}
              filteredUserMenuItems={filteredUserMenuItems}
              userInitials={userInitials}
              handleLogout={handleLogout}
              isLoggingOut={isLoggingOut}
              onSettingsClick={() => setSettingsOpen(true)}
            />
          ) : (
            <Button
              variant="accent"
              className="hidden md:block"
              aria-label="Sign In"
              title="Sign In"
              onClick={() => setAuthOpen(true)}
            >
              Sign In
            </Button>
          )}
          {/* Mobile Navigation */}
          <Sheet
            open={mobileMenuOpen}
            onOpenChange={setMobileMenuOpen}
            closeOnDesktop
          >
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                title="Open menu"
                className="md:hidden"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <MobileMenu
              onSignInClick={() => setAuthOpen(true)}
              user={user}
              headerNavigation={filteredHeaderNavigation}
              filteredUserMenuItems={filteredUserMenuItems}
              isAuthenticated={isAuthenticated}
              userInitials={userInitials}
              handleLogout={handleLogout}
              isLoggingOut={isLoggingOut}
              isActive={isActive}
            />
          </Sheet>
        </div>
      </header>
    </>
  );
};

export default Header;
