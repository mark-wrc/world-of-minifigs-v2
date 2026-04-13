import { GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import CommonImage from "@/components/shared/CommonImage";

const PreviewCard = ({
  item,
  idx,
  displayQuantity,
  dragHandleProps = {},
  isDragging = false,
  cardProps = {},
}) => (
  <Card
    className={`relative p-2 ${isDragging ? "ring-2 ring-accent" : ""}`}
    {...cardProps}
  >
    <div className="aspect-4/3 relative overflow-hidden group">
      {dragHandleProps && Object.keys(dragHandleProps).length > 0 && (
        <div className="absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="size-4 text-muted-foreground" />
        </div>
      )}

      <Badge variant="accent" className="absolute top-0 right-0 size-7 text-lg font-bold">
        {displayQuantity}
      </Badge>

      <CommonImage
        src={item.image?.url}
        alt={`Torso ${idx}`}
        className="w-full h-full"
      />
    </div>
  </Card>
);

export const PreviewItem = ({ item, idx, displayQuantity }) => (
  <PreviewCard item={item} idx={idx} displayQuantity={displayQuantity} />
);

export const SortablePreviewItem = ({ id, item, idx, displayQuantity }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <PreviewCard
      item={item}
      idx={idx}
      displayQuantity={displayQuantity}
      isDragging={isDragging}
      dragHandleProps={listeners}
      cardProps={{
        ref: setNodeRef,
        style: {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
          zIndex: isDragging ? 50 : 1,
        },
        className: `relative p-2 cursor-grab active:cursor-grabbing ${isDragging ? "ring-2 ring-accent" : ""}`,
        ...attributes,
        ...listeners,
      }}
    />
  );
};
