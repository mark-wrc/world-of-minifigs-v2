const ErrorState = ({
  title = "Something went wrong",
  description = "We're having trouble loading this content. Please try again later.",
  minHeight = "min-h-[50vh]",
  showError = true,
}) => {
  if (!showError) {
    return null;
  }

  return (
    <div
      className={`px-5 py-20 ${minHeight} flex flex-col items-center justify-center text-center`}
    >
      <h3 className="text-2xl font-extrabold mb-3 uppercase">{title}</h3>
      <div className="text-muted-foreground">
        {description}
      </div>
    </div>
  );
};

export default ErrorState;
