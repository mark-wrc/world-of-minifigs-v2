import React from "react";

const HIGHLIGHT_PATTERN = /<y>([\s\S]*?)<\/y>/g;

const HighlightText = ({ text, className = "text-accent" }) => {
  if (!text) return null;

  const parts = text.split(HIGHLIGHT_PATTERN);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={className}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
};

export default HighlightText;
