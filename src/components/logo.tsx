import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2 group", className)}>
      <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-elegant">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6" role="img" aria-label="Testum logo">
          <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.12)" />
          <text x="12" y="16" textAnchor="middle" fontFamily="Inter, system-ui, Arial" fontWeight="700" fontSize="12" fill="white">T</text>
        </svg>
      </div>
      {showWordmark && (
        <span className="font-display text-xl font-bold tracking-tight">
          Testum<span className="text-primary">.</span>
        </span>
      )}
    </Link>
  );
}
