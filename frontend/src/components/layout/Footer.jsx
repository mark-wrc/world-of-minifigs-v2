import React from "react";
import { Badge } from "@/components/ui/badge";
import { footerNavigation } from "@/constant/footerNavigation";

const Footer = () => {
  return (
    <footer className="bg-accent dark:bg-background dark:border-t">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 border-b border-muted-foreground/10 p-5">
        {footerNavigation.map(({ id, title, description, isSocial, links }) => (
          <div key={id} className="space-y-5">
            <div className="relative pb-2">
              <h3 className="text-xl font-bold text-foreground">{title}</h3>
              <span className="absolute bottom-0 left-0 w-12 h-0.5 bg-foreground dark:bg-accent" />
            </div>

            {description && (
              <p className="text-sm leading-relaxed">{description}</p>
            )}

            {isSocial ? (
              <div className="flex items-center gap-3">
                {links.map((item) => (
                  <a
                    key={item.id || item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={item.label}
                    aria-label={item.label}
                  >
                    <Badge className="p-2 hover:text-accent cursor-pointer dark:border-border">
                      <item.icon />
                    </Badge>
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {links.map((item, index) => (
                  <span
                    key={item.id || `${item.label}-${index}`}
                    className="text-sm dark:hover:text-accent hover:font-medium transition-colors wrap-break-word cursor-pointer"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center text-md p-5">
        © Copyright World of Minifigs {new Date().getFullYear()}. All rights
        reserved
      </div>
    </footer>
  );
};

export default Footer;
