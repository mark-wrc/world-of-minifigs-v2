import React from "react";
import { Badge } from "@/components/ui/badge";
import PageHero from "@/components/shared/PageHero";
import SectionWithCards from "@/components/shared/SectionWithCards";
import PageCTA from "@/components/shared/PageCTA";
import CommonImage from "@/components/shared/CommonImage";
import {
  aboutHero,
  aboutStory,
  aboutOrder,
  aboutChoose,
  aboutExplore,
} from "@/constant/aboutData";

const About = () => {
  return (
    <>
      <PageHero
        title={aboutHero.title}
        highlight={aboutHero.highlight}
        title2={aboutHero.title2}
        description={aboutHero.description}
      />

      {/* Our Story */}
      <section className="py-10 px-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <CommonImage
            src={aboutStory.image}
            alt={aboutStory.title}
            className="w-full h-full rounded-md border"
          />

          <div className="space-y-4 leading-relaxed">
            <Badge variant="brand" className="px-3 py-1 text-sm uppercase">
              {aboutStory.badge}
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase leading-tight">
              {aboutStory.title}
            </h1>

            <div className="space-y-3">
              {aboutStory.story.map((paragraph, id) => (
                <p key={id}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Just 3 Easy Steps */}
      <SectionWithCards
        badge={aboutOrder.badge}
        title={aboutOrder.title}
        description={aboutOrder.description}
        items={aboutOrder.steps}
        background={true}
      />

      {/* Why Choose Us? */}
      <SectionWithCards
        badge={aboutChoose.badge}
        title={aboutChoose.title}
        description={aboutChoose.description}
        items={aboutChoose.features}
      />

      {/* Start Adventure CTA */}
      <PageCTA
        title={aboutExplore.title}
        highlight={aboutExplore.highlight}
        description={aboutExplore.description}
        buttonText={aboutExplore.buttonText}
        buttonLink={aboutExplore.buttonLink}
        backgroundImage={aboutExplore.image}
      />
    </>
  );
};

export default About;
