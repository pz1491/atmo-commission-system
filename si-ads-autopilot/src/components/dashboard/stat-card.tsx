"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function useCountUp(target: number, durationMs = 600) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    let raf: number;
    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / durationMs, 1);
      setValue(target * progress);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

export function StatCard({
  label,
  value,
  format,
  changePercent,
  changeLabel = "vs yesterday",
  invertChangeColor = false,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  changePercent?: number | null;
  changeLabel?: string;
  invertChangeColor?: boolean;
}) {
  const animated = useCountUp(value);
  const positive = (changePercent ?? 0) >= 0;
  const goodDirection = invertChangeColor ? !positive : positive;

  return (
    <Card className="card-hover p-5">
      <div className="text-sm text-secondary-text">{label}</div>
      <div className="mt-1 text-[28px] font-semibold tabular-nums leading-none">
        {format(animated)}
      </div>
      {changePercent !== null && changePercent !== undefined && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1 text-xs font-medium",
            goodDirection ? "text-success" : "text-danger",
          )}
        >
          {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(changePercent).toFixed(1)}% {changeLabel}
        </div>
      )}
    </Card>
  );
}
