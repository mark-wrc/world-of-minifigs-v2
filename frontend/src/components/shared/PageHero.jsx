import { Badge } from "@/components/ui/badge";

const PageHero = ({
  title,
  highlight,
  title2,
  description,
  badge,
  features,
  action,
  bannerPadding = "py-20",
}) => {
  return (
    <section
      className={`relative overflow-hidden ${bannerPadding} border border-border/50`}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-24 -left-24 w-64 h-64 md:w-96 md:h-96 rounded-full bg-accent" />
        <div className="absolute top-1/2 right-1/4 w-56 h-56 md:w-64 md:h-64 rounded-full bg-accent" />
        <div className="absolute -bottom-32 -right-32 w-52 h-52 md:w-64 md:h-64 rounded-full bg-accent" />
      </div>

      <div className="relative text-center flex flex-col items-center px-5">
        {badge && (
          <Badge variant="accent" className="px-3 py-1 text-sm mb-5">
            {badge}
          </Badge>
        )}

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold uppercase leading-tight">
          {title && (
            <>
              {title}
              {highlight && <>&nbsp;</>}
            </>
          )}
          {highlight && <span className="text-accent">{highlight}</span>}
          {title2 && (
            <>
              &nbsp;
              <br />
              {title2}
            </>
          )}
        </h1>

        {description && (
          <div className="mx-auto max-w-3xl mt-3">
            <p className="text-sm md:text-lg">{description}</p>
          </div>
        )}

        {features && features.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {features.map((feature, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="px-3 py-2 text-sm border-border flex items-center gap-3 bg-card text-foreground"
              >
                {feature.icon && (
                  <feature.icon size={18} className="text-accent" />
                )}
                {feature.label}
              </Badge>
            ))}
          </div>
        )}

        {action && <div className="mt-7">{action}</div>}
      </div>
    </section>
  );
};

export default PageHero;
