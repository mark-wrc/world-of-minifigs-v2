import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { authApi, useGetDealerFlashSaleQuery } from "@/redux/api/authApi";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Below this much time remaining the banner switches to its urgent treatment.
const URGENT_THRESHOLD_MS = HOUR;

const pad = (value) => String(value).padStart(2, "0");

// The remaining duration split into one labelled unit per box — the banner
// renders each of these separately. Days drop out of the list entirely once
// they hit zero rather than sitting there as an empty "00". Clamped at zero so
// a sale that slipped past its deadline can never render negative digits.
const buildCountdownParts = (ms) => {
  const safe = Math.max(0, ms);
  const days = Math.floor(safe / DAY);
  const parts = [
    { label: "Hrs", value: pad(Math.floor((safe % DAY) / HOUR)) },
    { label: "Min", value: pad(Math.floor((safe % HOUR) / MINUTE)) },
    { label: "Sec", value: pad(Math.floor((safe % MINUTE) / SECOND)) },
  ];
  return days > 0
    ? [{ label: days === 1 ? "Day" : "Days", value: String(days) }, ...parts]
    : parts;
};

// Drives the storefront flash-sale banner: which sale to show, and how long is
// left on it. Ticks once a second while a sale is on screen and does nothing at
// all when there is none.
export const useDealerFlashSale = (channel) => {
  const dispatch = useDispatch();
  const { data } = useGetDealerFlashSaleQuery(channel || "dealer");

  const flashSale = data?.flashSale || null;
  const serverTime = data?.serverTime;

  // What the banner counts down to: a running sale counts to its close, a teased
  // one counts to its open.
  const targetMs = useMemo(() => {
    if (!flashSale) return null;
    const target =
      flashSale.status === "active" ? flashSale.endAt : flashSale.startAt;
    const parsed = new Date(target).getTime();
    return isNaN(parsed) ? null : parsed;
  }, [flashSale]);

  // "Now", on the SERVER's clock, sampled on a one-second beat. A device whose
  // clock is off by hours would otherwise expire a live sale early (or keep a
  // finished one ticking), so each sample is corrected by the skew measured when
  // the response landed. That skew is latched once per response — resampling it
  // every tick would fold the elapsed time back in and make the clock drift.
  //
  // Starts at 0, meaning "not sampled yet", which keeps the banner hidden for
  // the frame before the first sample instead of flashing a bogus duration.
  const [serverNowMs, setServerNowMs] = useState(0);
  useEffect(() => {
    if (targetMs === null || !serverTime) return undefined;

    const skew = new Date(serverTime).getTime() - Date.now();
    const sample = () => setServerNowMs(Date.now() + skew);

    const firstSample = setTimeout(sample, 0);
    const beat = setInterval(sample, SECOND);
    return () => {
      clearTimeout(firstSample);
      clearInterval(beat);
    };
  }, [targetMs, serverTime]);

  const hasClock = serverNowMs > 0 && targetMs !== null;
  const remainingMs = hasClock ? targetMs - serverNowMs : 0;

  // Crossing a boundary moves real money: a sale opening or closing changes the
  // price of every participating add-on. Refresh the add-on list alongside this
  // banner rather than leaving the dealer looking at prices that no longer
  // apply. The ref fires this exactly once per boundary.
  const crossedBoundaryRef = useRef(null);
  useEffect(() => {
    if (!flashSale || !hasClock || remainingMs > 0) return;
    const boundary = `${flashSale._id}:${flashSale.status}`;
    if (crossedBoundaryRef.current === boundary) return;
    crossedBoundaryRef.current = boundary;
    dispatch(authApi.util.invalidateTags(["FlashSale", "Addon"]));
  }, [flashSale, hasClock, remainingMs, dispatch]);

  return {
    flashSale,
    // Hidden once the clock runs out, until the refetch above says otherwise —
    // an expired banner is worse than no banner.
    isVisible: Boolean(flashSale) && hasClock && remainingMs > 0,
    isUpcoming: flashSale?.status === "scheduled",
    isUrgent:
      flashSale?.status === "active" && remainingMs <= URGENT_THRESHOLD_MS,
    countdownParts: buildCountdownParts(remainingMs),
  };
};

export default useDealerFlashSale;
