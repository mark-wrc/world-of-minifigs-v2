import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Search, ShoppingCart, Sun, Moon, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import Logo from "@/assets/media/Logo.png";
import MobileMenu from "@/components/layout/MobileMenu";
import { headerNavigation } from "@/constant/headerNavigation";
import { useThemeToggle } from "@/hooks/useToggleTheme";
import Auth from "@/pages/Auth";

const Header = () => {
  const { darkMode, toggleDarkMode } = useThemeToggle();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <Auth open={authOpen} onOpenChange={setAuthOpen} />
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 bg-popover-foreground dark:bg-background border-b shadow-xs">
        <Link to="/" className="flex items-center">
          <img src={Logo} alt="World of Minifigs" className="h-20 p-1" />
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            title="Search Products"
          >
            <Search />
          </Button>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            aria-label="Toggle theme"
            title={darkMode ? "Toggle Light mode" : "Toggle Dark mode"}
          >
            {darkMode ? <Sun /> : <Moon />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="User"
            title="User"
            onClick={() => setAuthOpen(true)}
            className="hidden md:inline-flex"
          >
            <User />
          </Button>
          <Button
            variant="accent"
            className="hidden md:block"
            aria-label="Sign In"
            title="Sign In"
            onClick={() => setAuthOpen(true)}
          >
            Sign In
          </Button>

          {/* Mobile Navigation */}
          <Sheet>
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
            <MobileMenu onSignInClick={() => setAuthOpen(true)} />
          </Sheet>
        </div>
      </header>
    </>
  );
};

export default Header;
