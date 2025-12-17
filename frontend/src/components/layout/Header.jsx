import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { Search, ShoppingCart, Sun, Moon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import Logo from "@/assets/media/Logo.png";
import { headerNavigation } from "@/constant/headerNavigation";
import { APP_NAME } from "@/constant/appConfig";
import MobileMenu from "@/components/layout/MobileMenu";
import UserDropdown from "@/components/layout/UserDropdown";
import Auth from "@/pages/Auth";
import { useThemeToggle } from "@/hooks/useToggleTheme";

const Header = () => {
  const { darkMode, toggleDarkMode } = useThemeToggle();
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  return (
    <>
      <Auth open={authOpen} onOpenChange={setAuthOpen} />
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 bg-popover-foreground dark:bg-background border-b shadow-xs">
        <Link to="/" className="flex items-center">
          <img src={Logo} alt={APP_NAME} className="h-20 p-1" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-10">
          {headerNavigation.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                isActive
                  ? "text-accent decoration-2 underline underline-offset-8 transition-colors"
                  : "text-background dark:text-foreground hover:text-accent dark:hover:text-accent transition-colors"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          {/* Search Button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            title="Search Products"
          >
            <Search />
          </Button>
          {/* Cart Button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cart"
            asChild
            title="View Cart"
          >
            <Link to="/cart">
              <ShoppingCart />
            </Link>
          </Button>
          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            aria-label="Toggle theme"
            title={darkMode ? "Toggle Light mode" : "Toggle Dark mode"}
          >
            {darkMode ? <Sun /> : <Moon />}
          </Button>
          {/* User Dropdown or Sign In Button */}
          {isAuthenticated ? (
            <UserDropdown user={user} />
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
            <MobileMenu onSignInClick={() => setAuthOpen(true)} user={user} />
          </Sheet>
        </div>
      </header>
    </>
  );
};

export default Header;
