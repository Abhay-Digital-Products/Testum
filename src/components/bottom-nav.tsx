import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ClipboardList, BarChart3, User, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean };
const items: NavItem[] = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/tests", label: "Tests", icon: ClipboardList },
  { to: "/app/results", label: "Results", icon: BarChart3 },
  { to: "/app/pricing", label: "Plans", icon: Crown },
  { to: "/app/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Hide on the attempt player
  if (path.startsWith("/app/attempt/")) return null;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to as never}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl transition-all",
                    active && "bg-primary text-primary-foreground shadow-elegant",
                  )}
                >
                  <Icon className="h-4.5 w-4.5" size={18} />
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
