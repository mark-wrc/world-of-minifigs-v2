import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const SectionWithCards = ({
  background = false,
  className = "",
  badge,
  title,
  description,
  items,
  gridCols = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
}) => {
  return (
    <section
      className={`px-5 py-10 ${background ? "bg-input/50 dark:bg-card/50" : ""} ${className}`}
    >
      <div className="text-center mb-10 space-y-3">
        {badge && (
          <Badge variant="brand" className="px-3 py-1 text-sm uppercase">
            {badge}
          </Badge>
        )}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mt-5 uppercase">
          {title}
        </h2>
        {description && <p className="mx-auto max-w-3xl">{description}</p>}
      </div>

      <div className={`grid ${gridCols} gap-5 text-center`}>
        {items.map((item, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-col items-center text-center">
              {item.icon && (
                <div
                  className={`text-primary-foreground font-bold mb-5 bg-primary h-20 w-20 rounded-full flex items-center justify-center shadow-lg border-4 border-background`}
                >
                  <item.icon size={32} strokeWidth={1.5} />
                </div>
              )}
              <CardTitle className="text-xl font-bold">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="leading-relaxed text-accent-foreground dark:text-foreground">
                {item.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default SectionWithCards;
