import React from "react";
import { Link } from "react-router-dom";
import { LogOut, User, LayoutDashboard, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, getInitials } from "@/hooks/useLogin";

const UserDropdown = ({ user }) => {
  const { handleLogout, isLoggingOut } = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar>
          {user?.profilePicture?.url && (
            <AvatarImage src={user.profilePicture.url} alt={user.username} />
          )}
          <AvatarFallback>{getInitials(user)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <p className="font-semibold">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-popover-foreground/80">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <User className="mr-2 size-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        {user?.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="mr-2 size-4" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="mr-2 size-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
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
