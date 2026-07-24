import { Crown, Sparkles, Flame, Star, Zap, Gem, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getItemBadge } from "@shared/itemBadges";

// Icon lookup for the `icon` key on each badge in shared/itemBadges.js. This is
// the only badge detail that can't live in the shared file (it needs the React
// components), so add an entry here when a new badge uses an icon not listed.
const BADGE_ICONS = {
  crown: Crown,
  sparkles: Sparkles,
  flame: Flame,
  star: Star,
  zap: Zap,
  gem: Gem,
  tag: Tag,
};

// The pill shown on an inventory item card (dealer add-on preview). Renders
// nothing when the item carries no badge, so callers can drop it in unguarded.
const ItemBadge = ({ value, className = "" }) => {
  const badge = getItemBadge(value);
  if (!badge) return null;

  const Icon = BADGE_ICONS[badge.icon] || Tag;

  return (
    <div
      title={`${badge.label} item`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-md ring-1 ${badge.pillClassName} ${className}`}
    >
      <Icon className="size-3 fill-current" strokeWidth={0} />
      {badge.label}
    </div>
  );
};

// Compact variant for admin tables — uses the shadcn <Badge /> variant declared
// on the badge definition instead of the gradient pill.
export const ItemBadgeChip = ({ value, className = "" }) => {
  const badge = getItemBadge(value);
  if (!badge) return null;

  return (
    <Badge
      variant={badge.tableVariant}
      className={`text-[10px] px-1.5 py-0 leading-4 ${className}`}
    >
      {badge.label}
    </Badge>
  );
};

export default ItemBadge;
