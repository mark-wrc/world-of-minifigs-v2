import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { headerNavigation } from "@/constant/headerNavigation";
import { LogOut, User, LayoutDashboard, Settings } from "lucide-react";
import { useLogout, getInitials } from "@/hooks/useLogin";

const MobileMenu = ({ onSignInClick, user }) => {
  const { handleLogout, isLoggingOut } = useLogout();
  const { isAuthenticated } = useSelector((state) => state.auth);
  
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <SheetContent className="flex h-full flex-col p-5">
      <SheetHeader className="p-2">
        <SheetTitle>
          {isAuthenticated && user && (
            <div className="flex items-center gap-3">
              <Avatar className="flex border size-10">
                {user?.profilePicture?.url && (
                  <AvatarImage
                    src={user.profilePicture.url}
                    alt={user.username}
                  />
                )}
                <AvatarFallback>{getInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs text-popover-foreground/80">
                  {user?.email}
                </span>
              </div>
            </div>
          )}
        </SheetTitle>
        <SheetDescription className="sr-only">
          This is the mobile menu on a mobile device.
        </SheetDescription>
      </SheetHeader>

      <nav className="flex-1 flex flex-col gap-2 pt-5">
        {headerNavigation.map((item) => (
          <SheetClose asChild key={item.id}>
            <NavLink
              to={item.path}
              className={
                isActive(item.path)
                  ? "flex items-center gap-3 px-4 py-3 rounded-lg bg-accent dark:text-secondary-foreground font-semibold transition-colors"
                  : "flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-muted-foreground/10 transition-colors"
              }
            >
              {<item.icon size={20} />}
              {item.label}
            </NavLink>
          </SheetClose>
        ))}

        {/* Authenticated User Links */}
        {isAuthenticated && (
          <>
            <div className="border-t pt-4 mt-2">
              <SheetClose asChild>
                <NavLink
                  to="/profile"
                  className={
                    isActive("/profile")
                      ? "flex items-center gap-3 px-4 py-3 rounded-lg bg-accent dark:text-secondary-foreground font-semibold transition-colors"
                      : "flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-muted-foreground/10 transition-colors"
                  }
                >
                  <User size={20} />
                  Profile
                </NavLink>
              </SheetClose>
            </div>
            {user?.role === "admin" && (
              <SheetClose asChild>
                <NavLink
                  to="/dashboard"
                  className={
                    isActive("/dashboard")
                      ? "flex items-center gap-3 px-4 py-3 rounded-lg bg-accent dark:text-secondary-foreground font-semibold transition-colors"
                      : "flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-muted-foreground/10 transition-colors"
                  }
                >
                  <LayoutDashboard size={20} />
                  Dashboard
                </NavLink>
              </SheetClose>
            )}
            <SheetClose asChild>
              <NavLink
                to="/settings"
                className={
                  isActive("/settings")
                    ? "flex items-center gap-3 px-4 py-3 rounded-lg bg-accent dark:text-secondary-foreground font-semibold transition-colors"
                    : "flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-muted-foreground/10 transition-colors"
                }
              >
                <Settings size={20} />
                Settings
              </NavLink>
            </SheetClose>
          </>
        )}
      </nav>

      {isAuthenticated ? (
        <SheetClose asChild>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? "Logging out..." : "Log out"}
          </Button>
        </SheetClose>
      ) : (
        <SheetClose asChild>
          <Button variant="accent" className="w-full" onClick={onSignInClick}>
            Sign In
          </Button>
        </SheetClose>
      )}
    </SheetContent>
  );
};

export default MobileMenu;
