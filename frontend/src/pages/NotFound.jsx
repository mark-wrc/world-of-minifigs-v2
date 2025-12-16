import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      <h1 className="text-6xl font-bold">404</h1>
      <h2 className="text-2xl font-semibold mb-5">Page Not Found</h2>
      <p className="text-muted-foreground mb-5">
        The page you're looking for doesn't exist.
      </p>
      <Button variant="accent" asChild>
        <Link to="/">Go Back Home</Link>
      </Button>
    </div>
  );
};

export default NotFound;
