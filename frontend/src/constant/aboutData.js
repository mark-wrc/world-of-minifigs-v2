import { Award, Clock, Package } from "lucide-react";
import storyImage from "@/assets/media/aboutStory.png";
import aboutExploreImage from "@/assets/media/aboutExplore.png";
import { APP_NAME } from "@/constant/appConfig";

export const aboutHero = {
  title: "Fueling Your",
  highlight: "LEGO",
  title2: "Adventures with Authentic Parts",
  description:
    "Brick by Brick, Uniting LEGO Lovers – Where Every Piece Connects and Every Builder Belongs!",
};

export const aboutStats = [
  {
    number: "50+",
    label: "Custom Projects",
  },
  {
    number: "1000+",
    label: "Buyers",
  },
  {
    number: "97%",
    label: "Satisfied Buyers",
  },
];

export const aboutStory = {
  badge: "OUR STORY",
  title: "A Father-Son Journey Into the World of LEGO",
  image: storyImage,
  story: [
    `${APP_NAME} is an online store that offers a wide range of LEGO parts, minifigures, sets, and other brick-related items. We started our journey as a father-son bonding, brought together by our mutual love for LEGO.`,
    "We are located in Utah, United States, where we carefully process all your orders. We take pride in delivering your ordered LEGO pieces from pet and smoke-free storage, ensuring they are in the best possible condition when they arrive.",
    "We have successfully delivered orders from various platforms such as Bricklink, eBay, and Etsy, with a customer satisfaction rate of over 97%. Our team is dedicated to providing you with an excellent brick-shopping experience.",
  ],
};

export const aboutOrder = {
  badge: "JUST 3 EASY STEPS",
  title: "Snap, Shop, and Ship",
  description:
    "Whether you're a seasoned builder or just starting out, placing an order is as easy as stack, click, and build. Follow these simple steps to bring your LEGO dreams to life.",
  steps: [
    {
      title: "Explore Our Collection",
      description:
        "Visit the Shop page to view all World of Minifigs products. Filter by category to find exactly what you need.",
    },
    {
      title: "Select Your Favorites",
      description:
        "Add your preferred custom sets to your cart and double-check the quantities. We offer discounts on selected items.",
    },
    {
      title: "Place Your Order",
      description:
        "Complete the order details, wait for the order confirmation, and you're all set! You'll receive your LEGO in no time.",
    },
  ],
};

export const aboutChoose = {
  badge: "WHY CHOOSE US",
  title: "Minifigure Magic, Delivered",
  description:
    "Discover why LEGO lovers trust us — from top tier quality and 100% authenticity to service that builds smiles with every order.",
  features: [
    {
      title: "100% Authentic LEGO Products",
      description:
        "We guarantee the authenticity of every product. All our items are genuine LEGO, sourced directly from trusted suppliers.",
      icon: Award,
    },
    {
      title: "Attentiveness on Point",
      description:
        "We ensure the timely delivery of the right products. Our careful packaging guarantees your items arrive in perfect condition.",
      icon: Package,
    },
    {
      title: "Exceptional Customer Service",
      description:
        "Our dedicated team is here to assist you from order placing to delivery. We respond to inquiries within 24 hours.",
      icon: Clock,
    },
  ],
};

export const aboutExplore = {
  title: "Ready to Start Your",
  highlight: "LEGO Adventures?",
  description:
    "Dive into our world of authentic LEGO parts and minifigures and start building your imagination — one brick at a time.",
  image: aboutExploreImage,
};
