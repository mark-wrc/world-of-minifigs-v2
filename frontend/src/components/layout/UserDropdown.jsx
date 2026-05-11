import React from "react";
import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const UserDropdown = ({
  user,
  filteredUserMenuItems,
  userInitials,
  handleLogout,
  isLoggingOut,
  onSettingsClick,
}) => {

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar>
          {user?.profilePicture?.url && (
            <AvatarImage src={user.profilePicture.url} alt={user.username} />
          )}
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <p className="font-semibold">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-popover-foreground/80">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filteredUserMenuItems.map((item) =>
          item.id === "settings" ? (
            <DropdownMenuItem key={item.id} onClick={onSettingsClick}>
              <item.icon className="mr-2 size-4" />
              <span>{item.label}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.id} asChild>
              <NavLink to={item.path}>
                <item.icon className="mr-2 size-4" />
                <span>{item.label}</span>
              </NavLink>
            </DropdownMenuItem>
          )
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-destructive focus:text-destructive font-medium"
        >
          <LogOut className="mr-2 size-4 text-destructive" />
          <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;
