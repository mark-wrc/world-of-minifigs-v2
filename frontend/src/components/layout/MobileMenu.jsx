import React from "react";
import { Link, NavLink } from "react-router-dom";
import {
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { headerNavigation } from "@/constant/headerNavigation";

const MobileMenu = ({ onSignInClick }) => {
  return (
    <SheetContent className="flex h-full flex-col p-5">
      <SheetHeader className="p-2">
        <SheetTitle className="text-lg">Menu</SheetTitle>
        <SheetDescription className="sr-only">
          This is the mobile menu on a mobile device.
        </SheetDescription>
      </SheetHeader>
      <nav className="flex-1 flex flex-col gap-5">
        {headerNavigation.map((item) => (
          <SheetClose asChild key={item.id}>
            <NavLink to={item.path} className="flex items-center gap-3">
              {<item.icon size={20} />}
              {item.label}
            </NavLink>
          </SheetClose>
        ))}
      </nav>

      <SheetClose asChild>
        <Button
          variant="accent"
          className="w-full"
          asChild
          onClick={onSignInClick}
        >
          <Link to="#">Sign In</Link>
        </Button>
      </SheetClose>
    </SheetContent>
  );
};

export default MobileMenu;
