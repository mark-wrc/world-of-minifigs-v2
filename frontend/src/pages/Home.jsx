import React from "react";
import Banner from "@/components/home/Banner";
import LatestProduct from "@/components/home/LatestProduct";
import CollectionsCarousel from "@/components/home/CollectionsCarousel";
import FeaturedCollections from "@/components/home/FeaturedCollections";
import RewardProgram from "@/components/home/RewardProgram";
import DealerCTA from "@/components/home/DealerCTA";

const Home = () => {
  return (
    <div>
      <Banner />
      <LatestProduct />
      <CollectionsCarousel />
      <FeaturedCollections />
      {/* <RewardProgram /> */}
      {/* <DealerCTA /> */}
    </div>
  );
};

export default Home;
