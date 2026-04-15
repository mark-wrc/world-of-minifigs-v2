import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const OrderCard = ({ orderCard }) => {
  const {
    detailUrl,
    statusConfig,
    invoiceLabel,
    createdAt,
    itemCount,
    totalAmount,
  } = orderCard;

  return (
    <Link to={detailUrl}>
      <Card>
        <CardContent className="space-y-4">
          {/* Order Info */}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-bold text-lg">Invoice #{invoiceLabel}</p>

              <Badge
                className={`text-xs font-medium flex items-center ${statusConfig.iconColor}`}
              >
                {statusConfig.label}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {createdAt} · {itemCount} item{itemCount !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border/70" />

          {/* Bottom Row */}
          <div className="flex items-center justify-between">
            <span className="font-bold text-success dark:text-accent text-2xl">
              {totalAmount}
            </span>

            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              View details
              <ChevronRight className="size-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default OrderCard;
