import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  aboutHero,
  aboutStats,
  aboutStory,
  aboutOrder,
  aboutChoose,
  aboutExplore,
} from "@/constant/aboutData";

const About = () => {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden py-40 border border-border/50">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -left-24 w-64 h-64 md:w-96 md:h-96 rounded-full bg-accent" />
          <div className="absolute top-1/2 right-1/4 w-56 h-56 md:w-64 md:h-64 rounded-full bg-accent" />
          <div className="absolute -bottom-32 -right-32 w-52 h-52 md:w-64 md:h-64 rounded-full bg-accent" />
        </div>

        <div className="relative px-5 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-5 leading-tight">
            {aboutHero.title}{" "}
            <span className="text-accent">{aboutHero.highlight}</span> <br />
            {aboutHero.title2}
          </h1>
          <div className="mx-auto max-w-xl">
            <p className="text-sm md:text-lg">{aboutHero.description}</p>
          </div>
        </div>
      </section>
      {/* Stats */}
      <section className="py-10 px-5 bg-input/50 dark:bg-card/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {aboutStats.map((stat, index) => (
            <Card key={index} className="text-center dark:shadow-none">
              <CardContent className="py-10">
                <div className="text-3xl font-bold text-accent-foreground dark:text-secondary-foreground mb-5 bg-accent h-28 w-28 mx-auto rounded-full flex items-center justify-center">
                  {stat.number}
                </div>
                <div className="font-bold">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      {/* Story */}
      <section className="py-10 px-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <img
              src={aboutStory.image}
              alt={aboutStory.title}
              className="w-full h-auto rounded-md"
            />
          </div>
          <div className="space-y-4 leading-relaxed">
            <Badge variant="accent" className="px-3 py-1 text-sm">
              {aboutStory.badge}
            </Badge>
            <h2 className="text-4xl font-bold leading-tight">{aboutStory.title}</h2>

            <div className="space-y-4">
              {aboutStory.story.map((paragraph, id) => (
                <p key={id}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* Order Steps */}
      <section className="py-10 px-5 bg-input/50 dark:bg-card/50">
        <div className="text-center mb-10">
          <Badge variant="accent" className="px-3 py-1 text-sm">
            {aboutOrder.badge}
          </Badge>
          <h2 className="text-4xl font-bold mt-5 mb-3">{aboutOrder.title}</h2>
          <p className="max-w-3xl mx-auto">{aboutOrder.description}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-center">
          {aboutOrder.steps.map((step, index) => (
            <Card key={index} className="text-center dark:shadow-none">
              <CardHeader>
                <div className="text-3xl font-bold text-accent-foreground dark:text-secondary-foreground mb-5 bg-accent h-20 w-20 mx-auto rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
                <CardTitle className="text-xl font-bold">
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed text-accent-foreground dark:text-foreground">
                  {step.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      {/* Why Choose Us */}
      <section className="py-10 px-5">
        <div className="text-center mb-10">
          <Badge variant="accent" className="px-3 py-1 text-sm">
            {aboutChoose.badge}
          </Badge>
          <h2 className="text-4xl font-bold mt-5 mb-3">{aboutChoose.title}</h2>
          <p className="max-w-3xl mx-auto">{aboutChoose.description}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-center">
          {aboutChoose.features.map((feature, index) => (
            <Card key={index} className="text-center dark:shadow-none">
              <CardHeader>
                <div className="text-3xl font-bold text-accent-foreground dark:text-secondary-foreground mb-5 bg-accent h-20 w-20 mx-auto rounded-full flex items-center justify-center">
                  <feature.icon size={24} />
                </div>
                <CardTitle className="text-xl font-bold">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed text-accent-foreground dark:text-foreground">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      {/* Explore CTA */}
      <section className="relative py-40 px-5 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${aboutExplore.image})` }}
        />
        <div className="absolute inset-0 bg-black/70 mix-blend-multiply"></div>
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold mb-5 text-background dark:text-foreground">
            {aboutExplore.title}{" "}
            <span className="text-accent">{aboutExplore.highlight}</span>
          </h2>
          <p className="text-background dark:text-foreground mb-8 text-sm md:text-lg">
            {aboutExplore.description}
          </p>
          <Button asChild variant="accent">
            <Link to="/products">Explore Products</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default About;
