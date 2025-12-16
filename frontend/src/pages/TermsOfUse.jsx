import React from "react";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { termsMetadata, termsData } from "@/constant/termsData";

const TermsOfUse = () => {
  return (
    <div className="space-y-5 py-10 px-5">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-5">
        <h1 className="text-5xl font-bold">{termsMetadata.title}</h1>
        <p className="text-sm text-muted-foreground mb-5">
          {termsMetadata.lastUpdated}
        </p>
      </div>

      {/* Terms Sections With Items */}
      {termsData.termsSectionsWithItems.map((section, index) => (
        <Card key={section.id || index}>
          <CardHeader>
            <div className="flex gap-5">
              <div className="w-14 h-14 rounded-lg bg-accent flex items-center justify-center">
                <section.icon className="text-accent-foreground dark:text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl">{section.title}</CardTitle>
                {section.description && (
                  <CardDescription className="leading-relaxed mt-1 text-accent-foreground dark:text-foreground">
                    {section.description}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2">
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span>
                    {item.label && (
                      <span className="font-medium">{item.label} </span>
                    )}
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {/* Terms Description Only Sections */}
      {termsData.termsDescriptionOnly.map((section, index) => (
        <Card key={section.id || index}>
          <CardHeader>
            <div className="flex gap-5">
              <div className="w-14 h-14 rounded-lg bg-accent flex items-center justify-center">
                <section.icon className="text-accent-foreground dark:text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl">{section.title}</CardTitle>
                <CardDescription className="leading-relaxed mt-1 text-accent-foreground dark:text-foreground">
                  {section.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}

      {/* Contact Information Section */}
      <Card>
        <CardHeader>
          <div className="flex gap-5">
            <div className="w-14 h-14 rounded-lg bg-accent flex items-center justify-center">
              <termsMetadata.cta.email.icon className="text-accent-foreground dark:text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">
                {termsMetadata.cta.title}
              </CardTitle>
              <CardDescription className="leading-relaxed mt-1 text-accent-foreground dark:text-foreground">
                {termsMetadata.cta.message}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="font-semibold">
            {termsMetadata.cta.company.companyName}
          </p>
          <div className="space-y-3 text-muted-foreground">
            <div className="flex items-start gap-3">
              <termsMetadata.cta.company.icon className="text-accent shrink-0 mt-0.5" />
              <span className="text-accent-foreground dark:text-foreground">
                {termsMetadata.cta.company.address}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <termsMetadata.cta.email.icon className="text-accent shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <a href={termsMetadata.cta.email.emailPath}>
                  <span className="text-accent-foreground dark:text-foreground hover:underline dark:hover:text-accent transition-colors">
                    {termsMetadata.cta.email.email}
                  </span>
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TermsOfUse;
