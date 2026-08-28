import { useEffect, useState } from "react";

const NEET_2027 = new Date("2027-05-02T00:00:00+05:30").getTime();

function calc() {
  const diff = Math.max(0, NEET_2027 - Date.now());
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff / 3_600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s };
}

export function Countdown({ compact, dark }: { compact?: boolean; dark?: boolean }) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setT(calc());
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  const items = [
    { v: t.d, l: "Days" },
    { v: t.h, l: "Hours" },
    { v: t.m, l: "Minutes" },
    { v: t.s, l: "Seconds" },
  ];
  return (
    <div className={compact ? "grid grid-cols-4 gap-2" : "grid grid-cols-4 gap-2 sm:gap-3"}>
      {items.map((it) => (
        <div
          key={it.l}
          className={
            dark
              ? "rounded-xl border border-white/15 bg-white/10 p-2.5 text-center text-white backdrop-blur-sm shadow-inner sm:p-3"
              : "rounded-xl border bg-card px-2 py-3 text-center text-foreground"
          }
        >
          <div
            className={
              dark
                ? "font-display text-2xl font-extrabold tabular-nums text-white sm:text-3xl"
                : "font-display text-2xl font-bold tabular-nums text-foreground sm:text-3xl"
            }
            suppressHydrationWarning
          >
            {mounted ? String(it.v).padStart(2, "0") : " - "}
          </div>
          <div
            className={
              dark
                ? "mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 sm:text-xs"
                : "mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs"
            }
          >
            {it.l}
          </div>
        </div>
      ))}
    </div>
  );
}
