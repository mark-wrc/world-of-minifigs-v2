import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminNavigation } from "@/constant/adminNavigation";
import { getInitials } from "@/hooks/useLogin";

const AdminPanel = () => {
  // Initialize isCollapsed from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("adminSidebarCollapsed");
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [expandedItems, setExpandedItems] = useState([]);
  const { user } = useSelector((state) => state.auth);
  const userInitials = getInitials(user);
  const location = useLocation();
  const navigate = useNavigate();

  // Save collapsed state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("adminSidebarCollapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // toggle the menu item children
  const toggleExpand = (itemId) => {
    setExpandedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Auto-expand parent items based on current route
  useEffect(() => {
    const currentPath = location.pathname.split("/").pop(); // Get the last segment of the path

    // Find parent items that should be expanded based on current route
    const itemsToExpand = adminNavigation
      .filter((item) => item.children)
      .filter((item) =>
        item.children.some((child) => child.path === currentPath)
      )
      .map((item) => item.id);

    if (itemsToExpand.length > 0) {
      setExpandedItems((prev) => {
        const newExpanded = [...new Set([...prev, ...itemsToExpand])];
        return newExpanded;
      });
    }
  }, [location.pathname]); // navlink button style
  const getNavLinkClassName = (
    isActive,
    isChild = false,
    isCollapsedIcon = false
  ) =>
    `flex items-center ${
      isCollapsedIcon ? "justify-center" : "gap-3"
    } px-4 py-3 rounded-lg transition-colors ${isChild ? "ml-5" : ""} ${
      isCollapsedIcon ? "cursor-pointer" : ""
    } ${
      isActive
        ? "bg-accent dark:text-secondary-foreground font-medium"
        : "text-foreground hover:bg-muted-foreground/10"
    }`;

  const renderNavItem = (item) => {
    if (item.children) {
      const isExpanded = expandedItems.includes(item.id);
      const currentPath = location.pathname.split("/").pop();
      const isChildActive = item.children.some(
        (child) => child.path === currentPath
      );

      // If sidebar is collapsed, show dropdown menu for categories and collections
      if (isCollapsed) {
        return (
          <DropdownMenu key={item.id}>
            <DropdownMenuTrigger asChild>
              <button
                className={`w-full ${getNavLinkClassName(
                  isChildActive,
                  false,
                  true
                )}`}
                title={item.label}
              >
                <item.icon size={20} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-56">
              {item.children.map((child) => (
                <DropdownMenuItem
                  key={child.id}
                  onClick={() => navigate(`/admin/${child.path}`)}
                  className="cursor-pointer"
                >
                  {child.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      // If sidebar is expanded, show normal accordion behavior
      return (
        <div key={item.id}>
          {/* toggle the menu item with children */}
          <button
            onClick={() => toggleExpand(item.id)}
            className="w-full flex items-center px-4 py-3 rounded-lg transition-colors text-foreground hover:bg-muted-foreground/10 cursor-pointer justify-between"
          >
            <div className="flex items-center gap-3">
              <item.icon size={20} />
              {!isCollapsed && <span>{item.label}</span>}
            </div>
            {!isCollapsed &&
              (isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              ))}
          </button>
          {/* render the children */}
          {!isCollapsed && isExpanded && (
            <div className="space-y-1 mt-1">
              {item.children.map((child) => (
                <NavLink
                  key={child.id}
                  to={child.path}
                  className={({ isActive }) =>
                    getNavLinkClassName(isActive, true)
                  }
                >
                  <span>{child.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      // item with no children
      <NavLink
        key={item.id}
        to={item.path}
        className={({ isActive }) => getNavLinkClassName(isActive)}
        title={isCollapsed ? item.label : undefined}
      >
        <item.icon size={20} />
        {!isCollapsed && <span>{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <section className="flex">
      {/* Sidebar */}
      <aside
        className={`bg-input/30 dark:bg-card/30 border-r border-border/30 transition-all duration-300 flex flex-col sticky top-20 h-screen ${
          isCollapsed ? "w-20" : "w-68"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b flex items-center gap-3 shrink-0 relative">
          <Avatar className="size-10">
            {user?.profilePicture?.url && (
              <AvatarImage
                src={user.profilePicture.url}
                alt={user?.username || "Admin"}
              />
            )}
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-popover-foreground/80 truncate">
                {user?.role}
              </p>
            </div>
          )}

          {/* Collapse Button */}
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            variant="outline"
            size="icon-sm"
            className="absolute top-7 right-0 translate-x-1/2 z-10 rounded-full"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronRight className={!isCollapsed ? "rotate-180" : ""} />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 min-h-0">
          {adminNavigation.map(renderNavItem)}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-5 py-7">
        <Outlet />
      </main>
    </section>
  );
};

export default AdminPanel;
