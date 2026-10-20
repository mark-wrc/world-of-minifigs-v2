import Order from "../models/order.model.js";
import Shipment from "../models/shipment.model.js";
import GeneralInventory from "../models/generalInventory.model.js";
import User from "../models/user.model.js";
import Bundle from "../models/bundle.model.js";
import DealerTorsoBag from "../models/dealerTorsoBag.model.js";
import DealerAddon from "../models/dealerAddon.model.js";
import DealerExtraBag from "../models/dealerExtraBag.model.js";
import "../models/subCollection.model.js";
import {
  ORDER_STATUSES,
  ORDER_TYPES,
  PAYMENT_GATEWAYS,
  REFUND_STATUSES,
  SHIPMENT_PAYMENT_SOURCES,
} from "../constants/orderConstants.js";

//------------------------------------------------ Helpers ------------------------------------------

// Order statuses that count as a sale (cancelled / failed are left out).
const SOLD_STATUSES = [
  ORDER_STATUSES.ON_HOLD,
  ORDER_STATUSES.PAID,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
];

const CHANNEL_TYPES = [ORDER_TYPES.DEALER, ORDER_TYPES.WHOLESALE];

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;
// Ranges longer than this are bucketed by month instead of by day.
const MAX_DAILY_BUCKETS = 62;
// A single day (25h allows for a DST change) is bucketed by hour.
const MAX_HOURLY_RANGE = 25 * 60 * 60 * 1000;

const BUCKET_FORMATS = { hour: "%Y-%m-%dT%H", day: "%Y-%m-%d", month: "%Y-%m" };
const TOP_LIMIT = 10;

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// The browser sends its own IANA zone so day buckets match the admin's calendar.
const resolveTimezone = (tz) => {
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
};

// `from` is inclusive, `to` exclusive. The previous period is the same length,
// immediately before.
const resolveRange = ({ from, to }) => {
  const end = parseDate(to) || new Date();
  const start =
    parseDate(from) || new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  if (start >= end) return null;
  const length = end.getTime() - start.getTime();
  return {
    from: start,
    to: end,
    previousFrom: new Date(start.getTime() - length),
    previousTo: start,
    bucket:
      length > MAX_DAILY_BUCKETS * DAY_MS
        ? "month"
        : length <= MAX_HOURLY_RANGE
          ? "hour"
          : "day",
  };
};

const toAmount = (value) => Math.round((value || 0) * 100) / 100;

const sumSales = (match) =>
  Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        sales: { $sum: "$payment.totalAmount" },
        orders: { $sum: 1 },
      },
    },
  ]).then(([row]) => ({
    sales: toAmount(row?.sales),
    orders: row?.orders || 0,
  }));

// Dealer + wholesale breakdown. Wholesale orders share the dealer order shape
// (`dealerItems`), so one pipeline covers both channels.
// Everything the admin currently sells to dealers / wholesalers, so items
// with no sales still show up (as 0) next to the ones that sold.
const getChannelCatalog = async (channelTypes) => {
  const [bundles, torsoBags, addons, extraBags] = await Promise.all([
    Bundle.find({ bundleType: "dealer", isActive: true }).select("bundleName").lean(),
    DealerTorsoBag.find({ isActive: true }).select("bagName").lean(),
    // Every add-on (active or not) so sold rows can show where each is sold.
    DealerAddon.find().select("addonName addonType visibleChannels isActive").lean(),
    DealerExtraBag.find({ isActive: true })
      .populate("subCollectionId", "subCollectionName")
      .select("subCollectionId")
      .lean(),
  ]);
  return {
    bundles: bundles.map((b) => ({ id: b._id, name: b.bundleName })),
    torsoBags: torsoBags.map((b) => ({ id: b._id, name: b.bagName })),
    // Add-ons saved before channels existed are dealer-only.
    addonChannels: new Map(
      addons.map((a) => [String(a._id), a.visibleChannels?.length ? a.visibleChannels : ["dealer"]]),
    ),
    addons: addons
      .filter((a) => {
        const channels = a.visibleChannels?.length ? a.visibleChannels : ["dealer"];
        return a.isActive && channels.some((c) => channelTypes.includes(c));
      })
      .map((a) => ({ id: a._id, name: a.addonName, type: a.addonType })),
    // Same name the checkout writes onto the order.
    extraBags: extraBags.map((b) => ({
      id: b._id,
      name: `Extra ${b.subCollectionId?.subCollectionName || "Bag"}`,
    })),
  };
};

// Append a zero row for every catalog item that didn't sell in the range.
const withCatalog = (rows, catalog, zero, keyOf = (r) => String(r.id)) => {
  const sold = new Set(rows.map(keyOf));
  const unsold = catalog
    .filter((item) => !sold.has(keyOf(item)))
    .map((item) => ({ ...item, ...zero, orders: 0 }));
  return [...rows, ...unsold];
};

const getChannelBreakdown = async (match, channelTypes) => {
  const catalogPromise = getChannelCatalog(channelTypes);
  const [facets] = await Order.aggregate([
    { $match: match },
    {
      $facet: {
        bundles: [
          { $unwind: "$dealerItems.bundles" },
          {
            $group: {
              _id: "$dealerItems.bundles.id",
              name: { $last: "$dealerItems.bundles.name" },
              copies: { $sum: { $ifNull: ["$dealerItems.bundles.quantity", 1] } },
              orders: { $addToSet: "$_id" },
              revenue: {
                $sum: {
                  $multiply: [
                    { $ifNull: ["$dealerItems.bundles.price", 0] },
                    { $ifNull: ["$dealerItems.bundles.quantity", 1] },
                  ],
                },
              },
            },
          },
        ],
        // Orders placed before multi-bundle support carry a single `bundle`.
        legacyBundles: [
          { $match: { "dealerItems.bundle.id": { $exists: true } } },
          {
            $group: {
              _id: "$dealerItems.bundle.id",
              name: { $last: "$dealerItems.bundle.name" },
              copies: { $sum: 1 },
              orders: { $addToSet: "$_id" },
              revenue: { $sum: { $ifNull: ["$dealerItems.bundle.price", 0] } },
            },
          },
        ],
        torsoBags: [
          { $unwind: "$dealerItems.bundles" },
          { $unwind: "$dealerItems.bundles.torsoBags" },
          {
            $group: {
              _id: "$dealerItems.bundles.torsoBags.id",
              name: { $last: "$dealerItems.bundles.torsoBags.name" },
              quantity: { $sum: "$dealerItems.bundles.torsoBags.quantity" },
              orders: { $addToSet: "$_id" },
            },
          },
        ],
        legacyTorsoBags: [
          { $unwind: "$dealerItems.torsoBags" },
          {
            $group: {
              _id: "$dealerItems.torsoBags.id",
              name: { $last: "$dealerItems.torsoBags.name" },
              quantity: { $sum: "$dealerItems.torsoBags.quantity" },
              orders: { $addToSet: "$_id" },
            },
          },
        ],
        addons: [
          { $unwind: "$dealerItems.addons" },
          {
            $group: {
              _id: "$dealerItems.addons.id",
              name: { $last: "$dealerItems.addons.name" },
              type: { $last: "$dealerItems.addons.type" },
              copies: { $sum: { $ifNull: ["$dealerItems.addons.quantity", 1] } },
              orders: { $addToSet: "$_id" },
              revenue: { $sum: { $ifNull: ["$dealerItems.addons.totalPrice", 0] } },
            },
          },
        ],
        // Individual inventory bags picked inside add-ons.
        bags: [
          { $unwind: "$dealerItems.addons" },
          { $unwind: "$dealerItems.addons.subItems" },
          {
            $group: {
              _id: "$dealerItems.addons.subItems.invId",
              name: { $last: "$dealerItems.addons.subItems.name" },
              colorName: { $last: "$dealerItems.addons.subItems.colorName" },
              colorHex: { $last: "$dealerItems.addons.subItems.colorHex" },
              category: { $last: "$dealerItems.addons.subItems.category" },
              snapshotBin: { $last: "$dealerItems.addons.subItems.bin" },
              bags: { $sum: "$dealerItems.addons.subItems.qty" },
              orders: { $addToSet: "$_id" },
              revenue: {
                $sum: { $ifNull: ["$dealerItems.addons.subItems.totalPrice", 0] },
              },
            },
          },
          { $sort: { bags: -1 } },
          // The bin can change after purchase — show where the bag lives now.
          {
            $lookup: {
              from: GeneralInventory.collection.name,
              localField: "_id",
              foreignField: "_id",
              as: "inventory",
            },
          },
        ],
        extraBags: [
          { $unwind: "$dealerItems.extraBags" },
          {
            $group: {
              _id: "$dealerItems.extraBags.id",
              name: { $last: "$dealerItems.extraBags.name" },
              quantity: { $sum: "$dealerItems.extraBags.quantity" },
              orders: { $addToSet: "$_id" },
              revenue: { $sum: { $ifNull: ["$dealerItems.extraBags.totalPrice", 0] } },
            },
          },
        ],
        customers: [
          {
            $group: {
              _id: "$userId",
              orderType: { $last: "$orderType" },
              email: { $last: "$email" },
              orders: { $sum: 1 },
              spent: { $sum: "$payment.totalAmount" },
              lastOrderAt: { $max: "$createdAt" },
            },
          },
          { $sort: { spent: -1 } },
          { $limit: TOP_LIMIT },
          {
            $lookup: {
              from: User.collection.name,
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
        ],
      },
    },
  ]);

  // Merge legacy + current rows that point at the same item.
  const mergeRows = (rows, sumKeys, keyOf = (row) => row._id ?? row.name) => {
    const map = new Map();
    for (const row of rows) {
      const key = String(keyOf(row));
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...row, orders: new Set(row.orders.map(String)) });
        continue;
      }
      sumKeys.forEach((k) => (existing[k] = (existing[k] || 0) + (row[k] || 0)));
      row.orders.forEach((id) => existing.orders.add(String(id)));
    }
    return [...map.values()].map(({ _id, orders, ...rest }) => ({
      id: _id,
      ...rest,
      orders: orders.size,
    }));
  };

  const finish = (rows, sortKey) =>
    rows
      .map((r) => ({
        ...r,
        ...(r.revenue !== undefined && { revenue: toAmount(r.revenue) }),
      }))
      .sort(
        (a, b) =>
          (b[sortKey] || 0) - (a[sortKey] || 0) ||
          String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
            numeric: true,
          }),
      );

  const countOrders = ({ orders, ...rest }) => ({ ...rest, orders: orders.length });
  const catalog = await catalogPromise;
  const bagNumber = (row) => (row.name || String(row.id ?? row._id)).trim().toLowerCase();

  return {
    bundles: finish(
      withCatalog(
        mergeRows([...facets.bundles, ...facets.legacyBundles], ["copies", "revenue"]),
        catalog.bundles,
        { copies: 0, revenue: 0 },
      ),
      "copies",
    ),
    torsoBags: finish(
      // Bag names are the bag numbers; a re-created bag keeps its number.
      withCatalog(
        mergeRows([...facets.torsoBags, ...facets.legacyTorsoBags], ["quantity"], bagNumber),
        catalog.torsoBags,
        { quantity: 0 },
        bagNumber,
      ),
      "quantity",
    ),
    addons: finish(
      withCatalog(
        facets.addons.map(({ _id, ...r }) => countOrders({ id: _id, ...r })),
        catalog.addons,
        { copies: 0, revenue: 0 },
      ).map((r) => ({ ...r, channels: catalog.addonChannels.get(String(r.id)) || [] })),
      "copies",
    ),
    bags: finish(
      facets.bags.map(({ _id, inventory, snapshotBin, ...r }) =>
        countOrders({
          id: _id,
          ...r,
          name: inventory?.[0]?.minifigName || r.name,
          bin: inventory?.[0]?.bin || snapshotBin || null,
        }),
      ),
      "bags",
    ),
    extraBags: finish(
      withCatalog(
        facets.extraBags.map(({ _id, ...r }) => countOrders({ id: _id, ...r })),
        catalog.extraBags,
        { quantity: 0, revenue: 0 },
      ),
      "quantity",
    ),
    topCustomers: facets.customers.map(({ _id, user, spent, ...r }) => ({
      userId: _id,
      name: [user?.[0]?.firstName, user?.[0]?.lastName].filter(Boolean).join(" "),
      spent: toAmount(spent),
      ...r,
    })),
  };
};

//------------------------------------------------ Get Dashboard Analytics ------------------------------------------

// GET /admin/dashboard/analytics?from=ISO&to=ISO&tz=Area/City&channel=all|dealer|wholesale
export const getDashboardAnalytics = async (req, res) => {
  try {
    const range = resolveRange(req.query);
    if (!range) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range",
        description: "The start date must be before the end date.",
      });
    }

    const timezone = resolveTimezone(req.query.tz);
    // "dealer" or "wholesale" scopes the whole dashboard to that order type;
    // anything else shows every order type.
    const channelFilter = CHANNEL_TYPES.includes(req.query.channel)
      ? req.query.channel
      : null;
    const channelTypes = channelFilter ? [channelFilter] : CHANNEL_TYPES;
    const typeMatch = channelFilter ? { orderType: channelFilter } : {};

    const inRange = {
      createdAt: { $gte: range.from, $lt: range.to },
      ...typeMatch,
    };
    const inPrevious = {
      createdAt: { $gte: range.previousFrom, $lt: range.previousTo },
      ...typeMatch,
    };
    const sold = { status: { $in: SOLD_STATUSES } };
    const channelMatch = { ...inRange, ...sold, orderType: { $in: channelTypes } };

    const [
      current,
      previous,
      overview,
      salesOverTime,
      standaloneShipping,
      channel,
      channelTotals,
      channelPrevious,
    ] = await Promise.all([
      sumSales({ ...inRange, ...sold }),
      sumSales({ ...inPrevious, ...sold }),
      Order.aggregate([
        { $match: inRange },
        {
          $facet: {
            byStatus: [{ $group: { _id: "$status", orders: { $sum: 1 } } }],
            byType: [
              { $match: sold },
              {
                $group: {
                  _id: "$orderType",
                  orders: { $sum: 1 },
                  sales: { $sum: "$payment.totalAmount" },
                },
              },
            ],
            byGateway: [
              { $match: sold },
              {
                $group: {
                  _id: { $ifNull: ["$payment.gateway", PAYMENT_GATEWAYS.STRIPE] },
                  orders: { $sum: 1 },
                  sales: { $sum: "$payment.totalAmount" },
                },
              },
            ],
            refunds: [
              { $match: { "refund.status": REFUND_STATUSES.COMPLETED } },
              {
                $group: {
                  _id: null,
                  amount: { $sum: { $ifNull: ["$refund.amount", 0] } },
                  orders: { $sum: 1 },
                },
              },
            ],
            fees: [
              { $match: sold },
              {
                $group: {
                  _id: null,
                  subtotal: { $sum: "$payment.subtotal" },
                  shipping: { $sum: { $ifNull: ["$payment.shippingFee", 0] } },
                  insurance: {
                    $sum: { $ifNull: ["$payment.shippingInsurance", 0] },
                  },
                  tax: { $sum: { $ifNull: ["$payment.taxAmount", 0] } },
                  discounts: {
                    $sum: { $ifNull: ["$payment.discount.amount", 0] },
                  },
                },
              },
            ],
          },
        },
      ]),
      Order.aggregate([
        { $match: { ...inRange, ...sold } },
        {
          $group: {
            _id: {
              period: {
                $dateToString: {
                  date: "$createdAt",
                  format: BUCKET_FORMATS[range.bucket],
                  timezone,
                },
              },
              type: "$orderType",
            },
            orders: { $sum: 1 },
            sales: { $sum: "$payment.totalAmount" },
          },
        },
        { $sort: { "_id.period": 1 } },
      ]),
      // Shipping-only checkouts for consolidated parcels are money taken
      // outside any order — reported separately so order totals stay exact.
      Shipment.aggregate([
        {
          $match: {
            paymentSource: SHIPMENT_PAYMENT_SOURCES.STANDALONE,
            createdAt: { $gte: range.from, $lt: range.to },
          },
        },
        // A shipment has no type of its own — keep it when it carries an
        // order of the filtered type.
        ...(channelFilter
          ? [
              {
                $lookup: {
                  from: Order.collection.name,
                  localField: "orders",
                  foreignField: "_id",
                  as: "orderDocs",
                },
              },
              { $match: { "orderDocs.orderType": channelFilter } },
            ]
          : []),
        {
          $group: {
            _id: { $ifNull: ["$payment.gateway", PAYMENT_GATEWAYS.STRIPE] },
            payments: { $sum: 1 },
            amount: { $sum: "$payment.totalAmount" },
          },
        },
      ]),
      getChannelBreakdown(channelMatch, channelTypes),
      sumSales(channelMatch),
      sumSales({ ...inPrevious, ...sold, orderType: { $in: channelTypes } }),
    ]);

    const [facets] = overview;
    const fees = facets.fees[0] || {};

    // Fold the per-type rows into one row per period.
    const periods = new Map();
    for (const row of salesOverTime) {
      const key = row._id.period;
      const entry = periods.get(key) || { period: key, orders: 0, sales: 0, byType: {} };
      entry.orders += row.orders;
      entry.sales += row.sales;
      entry.byType[row._id.type] = toAmount(row.sales);
      periods.set(key, entry);
    }

    return res.status(200).json({
      success: true,
      range: { ...range, timezone },
      kpis: {
        sales: { current: current.sales, previous: previous.sales },
        orders: { current: current.orders, previous: previous.orders },
        averageOrder: {
          current: current.orders ? toAmount(current.sales / current.orders) : 0,
          previous: previous.orders
            ? toAmount(previous.sales / previous.orders)
            : 0,
        },
        refunds: {
          amount: toAmount(facets.refunds[0]?.amount),
          orders: facets.refunds[0]?.orders || 0,
        },
      },
      breakdown: {
        subtotal: toAmount(fees.subtotal),
        shipping: toAmount(fees.shipping),
        insurance: toAmount(fees.insurance),
        tax: toAmount(fees.tax),
        discounts: toAmount(fees.discounts),
      },
      byStatus: facets.byStatus.map((r) => ({ status: r._id, orders: r.orders })),
      byType: facets.byType.map((r) => ({
        type: r._id,
        orders: r.orders,
        sales: toAmount(r.sales),
      })),
      byGateway: facets.byGateway.map((r) => ({
        gateway: r._id,
        orders: r.orders,
        sales: toAmount(r.sales),
      })),
      standaloneShipping: standaloneShipping.map((r) => ({
        gateway: r._id,
        payments: r.payments,
        amount: toAmount(r.amount),
      })),
      salesOverTime: [...periods.values()].map((p) => ({
        ...p,
        sales: toAmount(p.sales),
      })),
      channel: {
        types: channelTypes,
        sales: { current: channelTotals.sales, previous: channelPrevious.sales },
        orders: { current: channelTotals.orders, previous: channelPrevious.orders },
        ...channel,
      },
    });
  } catch (error) {
    console.error("Get dashboard analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
