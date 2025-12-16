import React from "react";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { policyMetadata, policyData } from "@/constant/policyData";

const PrivacyPolicy = () => {
  return (
    <div className="space-y-5 py-10 px-5">
      {/* Header with Icon */}
      <div className="flex flex-col items-center text-center space-y-5">
        <h1 className="text-5xl font-bold">{policyMetadata.title}</h1>
        <p className="text-sm text-muted-foreground mb-5">
          {policyMetadata.lastUpdated}
        </p>
      </div>

      {/* Information We Collect Section */}
      <Card>
        <CardHeader>
          <div className="flex gap-5">
            <div className="w-14 h-14 rounded-lg bg-accent flex items-center justify-center">
              <policyData.informationWeCollect.icon className="text-accent-foreground dark:text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">
                {policyData.informationWeCollect.title}
              </CardTitle>
              <CardDescription className="leading-relaxed mt-1 text-accent-foreground dark:text-foreground">
                {policyData.informationWeCollect.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {policyData.informationWeCollect.sections.map((section, index) => (
            <div key={index}>
              <p className="font-semibold mb-3 text-lg">{section.title}:</p>
              <ul className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-2">
                    <ChevronRight className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Policy Sections With Items */}
      {policyData.policySectionsWithItems.map((section, index) => (
        <Card key={index}>
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

      {/* Policy Description Only Sections */}
      {policyData.policyDescriptionOnly.map((section, index) => (
        <Card key={index}>
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

      {/* Contact Us Section */}
      <Card>
        <CardHeader>
          <div className="flex gap-5">
            <div className="w-14 h-14 rounded-lg bg-accent flex items-center justify-center">
              <policyMetadata.cta.email.icon className="text-accent-foreground dark:text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">
                {policyMetadata.cta.title}
              </CardTitle>
              <CardDescription className="leading-relaxed mt-1 text-accent-foreground dark:text-foreground">
                {policyMetadata.cta.message}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="font-semibold">
            {policyMetadata.cta.company.companyName}
          </p>
          <div className="space-y-3 text-muted-foreground">
            <div className="flex items-start gap-3">
              <policyMetadata.cta.company.icon className="text-accent shrink-0 mt-0.5" />
              <span className="text-accent-foreground dark:text-foreground">
                {policyMetadata.cta.company.address}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <policyMetadata.cta.email.icon className="text-accent shrink-0 mt-0.5" />
              <a href={policyMetadata.cta.email.emailPath}>
                <span className="text-accent-foreground dark:text-foreground hover:underline dark:hover:text-accent transition-colors">
                  {policyMetadata.cta.email.email}
                </span>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivacyPolicy;
