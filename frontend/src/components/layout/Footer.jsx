import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { footerNavigation } from "@/constant/pageNavigation";
import { APP_NAME } from "@/constant/appConfig";

const Footer = () => {
  return (
    // The sidebar tokens are the theme's black navbar/footer treatment
    // (#111 on light, #0D0D0D on dark) with a near-white foreground, so the
    // footer stays black in both themes instead of inverting.
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 border-b border-sidebar-foreground/10 p-5">
        {footerNavigation.map(({ title, description, isSocial, links }) => (
          <div key={title} className="space-y-5">
            <div className="relative pb-2">
              <h3 className="text-xl font-bold text-sidebar-foreground">
                {title}
              </h3>
              {/* Same gold -> orange -> crimson bar as the header's active link */}
              <span className="absolute bottom-0 left-0 w-12 h-0.5 rounded-full bg-linear-to-r from-accent via-chart-2 to-primary" />
            </div>

            {description && (
              <p className="text-sm leading-relaxed text-sidebar-foreground/70">
                {description}
              </p>
            )}

            {isSocial ? (
              <div className="flex items-center gap-3">
                {links.map((item) => (
                  <a
                    key={item.label}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={item.label}
                    aria-label={item.label}
                  >
                    {/* dark: overrides too — the default badge variant sets its
                        own dark bg/text that tailwind-merge won't strip. */}
                    <Badge className="p-2 cursor-pointer border-sidebar-foreground/15 bg-sidebar-foreground/10 dark:bg-sidebar-foreground/10 text-sidebar-foreground dark:text-sidebar-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                      <item.icon />
                    </Badge>
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {links.map((item) => {
                  if (item.path?.includes("mailto:")) {
                    return (
                      <a
                        key={item.label}
                        href={item.path}
                        className="text-sm text-sidebar-foreground/70 hover:text-accent transition-colors wrap-break-word cursor-pointer"
                      >
                        {item.label}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.path || item.label}
                      to={item.path}
                      className="text-sm text-sidebar-foreground/70 hover:text-accent transition-colors wrap-break-word cursor-pointer"
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center text-md p-5 text-sidebar-foreground/60">
        © {APP_NAME} {new Date().getFullYear()}. All rights reserved
      </div>
    </footer>
  );
};

export default Footer;
