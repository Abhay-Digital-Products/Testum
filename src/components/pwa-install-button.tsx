import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Smartphone, Download, Share, PlusSquare, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function PWAInstallModal({
  open,
  onOpenChange,
  isIOS,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isIOS: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-md p-6 rounded-3xl border shadow-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Smartphone className="h-6 w-6" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold">Install Testum App</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Get instant full-screen access, faster load times, and practice NEET tests without browser address bars!
          </DialogDescription>
        </DialogHeader>

        {isIOS ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border bg-slate-50 p-3.5 dark:bg-slate-900/50 flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600 font-bold text-sm">
                1
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                Tap the <span className="inline-flex items-center font-semibold text-primary"><Share className="inline h-3.5 w-3.5 mx-1" /> Share</span> button in Safari's bottom toolbar.
              </div>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-3.5 dark:bg-slate-900/50 flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600 font-bold text-sm">
                2
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                Scroll down and tap <span className="inline-flex items-center font-semibold text-primary"><PlusSquare className="inline h-3.5 w-3.5 mx-1" /> Add to Home Screen</span>.
              </div>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-3.5 dark:bg-slate-900/50 flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold text-sm">
                3
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                Tap <span className="font-semibold text-primary">Add</span> in the top right corner to install.
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900/50 text-center space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Tap the browser menu <span className="font-bold">(⋮)</span> at the top right and select <span className="font-semibold text-primary">"Install app"</span> or <span className="font-semibold text-primary">"Add to Home screen"</span>.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <Button onClick={() => onOpenChange(false)} className="w-full h-11 rounded-xl font-semibold">
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PWAInstallButton({
  variant = "default",
  size = "default",
  className,
  children,
  showBadge = false,
}: {
  variant?: "default" | "outline" | "secondary" | "ghost" | "hero";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
  showBadge?: boolean;
}) {
  const { isInstalled, isIOS, showIOSPrompt, setShowIOSPrompt, installApp } = usePWAInstall();

  if (isInstalled) {
    return null;
  }

  if (variant === "hero") {
    return (
      <>
        <button
          type="button"
          onClick={installApp}
          className={cn(
            "group relative inline-flex items-center justify-center gap-2.5 h-12 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-primary px-6 font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] hover:shadow-emerald-600/30 active:scale-[0.98]",
            className
          )}
        >
          <div className="absolute -top-2.5 -right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-amber-950 uppercase tracking-wider shadow-sm animate-pulse">
            Free App
          </div>
          <Smartphone className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
          <span>Install Mobile App</span>
          <Download className="h-3.5 w-3.5 opacity-80" />
        </button>

        <PWAInstallModal open={showIOSPrompt} onOpenChange={setShowIOSPrompt} isIOS={isIOS} />
      </>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={installApp}
        className={cn(
          "relative gap-1.5 transition-all",
          showBadge && "pr-3",
          className
        )}
      >
        <Smartphone className="h-4 w-4" />
        {children || <span>Install App</span>}
        {showBadge && (
          <span className="ml-1 rounded-full bg-emerald-500/15 text-emerald-600 px-1.5 py-0.2 text-[10px] font-bold">
            PWA
          </span>
        )}
      </Button>

      <PWAInstallModal open={showIOSPrompt} onOpenChange={setShowIOSPrompt} isIOS={isIOS} />
    </>
  );
}

export function PWAFloatingBanner() {
  const { isInstalled, isIOS, showIOSPrompt, setShowIOSPrompt, installApp } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:max-w-sm animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-card/95 p-3.5 shadow-2xl backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-md">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Install Testum App
                <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold text-primary">Fast</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Practice exams in full screen</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" onClick={installApp} className="h-8 rounded-lg text-xs font-semibold px-3 shadow-sm">
              Install
            </Button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <PWAInstallModal open={showIOSPrompt} onOpenChange={setShowIOSPrompt} isIOS={isIOS} />
    </>
  );
}
