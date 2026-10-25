"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  /** tween length in ms */
  duration?: number;
}

/** Eases from the previously shown value to the new one so equity and P&L glide instead of jumping. */
export function AnimatedNumber({ value, format, duration = 700 }: AnimatedNumberProps) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    if (origin === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const v = origin + (value - origin) * eased;
      from.current = v;
      setShown(v);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <>{format(shown)}</>;
}
