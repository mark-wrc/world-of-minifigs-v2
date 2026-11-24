// Does the line match every word typed (name, colour/group or bin)?
export const lineMatches = (line, query) => {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = [line?.name, line?.group, line?.bin && `bin ${line.bin}`]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
};
