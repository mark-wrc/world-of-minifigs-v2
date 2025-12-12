import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import useScrollToTop from "@/hooks/useScrollToTop";

const ScrollToTop = () => {
  const { isVisible, scrollToTop } = useScrollToTop();

  return (
    <>
      {isVisible && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-5 right-5 z-50 h-10 w-10 rounded-full bg-accent hover:bg-accent/80 shadow-lg"
          aria-label="Scroll to top"
        >
          <ArrowUp className="text-foreground dark:text-secondary-foreground" />
        </Button>
      )}
    </>
  );
};

export default ScrollToTop;
