import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { X, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface OfferData {
  id: string;
  title: string;
  image_url: string;
  target_url: string | null;
  button_text: string | null;
  coupon_code: string | null;
  is_active: boolean;
  display_frequency: string;
  target_audience: string;
}

export function OfferPopup() {
  const router = useRouter();
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAndShowOffer() {
      try {
        const { data: activeOffers, error } = await supabase
          .from("offer_popups")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (error || !activeOffers || activeOffers.length === 0) return;
        const currentOffer = activeOffers[0] as OfferData;

        if (!currentOffer.image_url) return;

        // Check target audience (if unsubscribed_only, check if user has paid entitlements)
        if (currentOffer.target_audience === "unsubscribed_only") {
          const { data: u } = await supabase.auth.getUser();
          if (u?.user) {
            const { data: ent } = await supabase
              .from("entitlements")
              .select("id")
              .eq("user_id", u.user.id)
              .maybeSingle();

            if (ent) return; // User already has a plan, skip showing
          }
        }

        // Check frequency rules
        const sessionKey = `testum_offer_${currentOffer.id}_session`;
        const dayKey = `testum_offer_${currentOffer.id}_day`;

        if (currentOffer.display_frequency === "once_per_session") {
          if (sessionStorage.getItem(sessionKey)) return;
        } else if (currentOffer.display_frequency === "once_per_day") {
          const lastDismissed = localStorage.getItem(dayKey);
          if (lastDismissed) {
            const elapsed = Date.now() - parseInt(lastDismissed, 10);
            if (elapsed < 24 * 60 * 60 * 1000) return;
          }
        }

        if (isMounted) {
          setOffer(currentOffer);
          // Slight delay for smooth entrance after page load
          const timer = setTimeout(() => {
            if (isMounted) setIsOpen(true);
          }, 600);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.error("Failed to load offer popup:", err);
      }
    }

    checkAndShowOffer();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    if (!offer) return;

    // Record dismissal according to frequency settings
    const sessionKey = `testum_offer_${offer.id}_session`;
    const dayKey = `testum_offer_${offer.id}_day`;

    sessionStorage.setItem(sessionKey, "true");
    localStorage.setItem(dayKey, Date.now().toString());
  };

  const handleCopyCoupon = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!offer?.coupon_code) return;
    navigator.clipboard.writeText(offer.coupon_code);
    setCopied(true);
    toast.success(`Coupon code "${offer.coupon_code}" copied to clipboard!`);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleBannerClick = () => {
    if (!offer) return;

    if (offer.coupon_code) {
      navigator.clipboard.writeText(offer.coupon_code);
      toast.success(`Coupon code "${offer.coupon_code}" copied!`);
    }

    handleDismiss();

    const target = offer.target_url || "/app/pricing";
    if (target.startsWith("http://") || target.startsWith("https://")) {
      window.open(target, "_blank", "noopener,noreferrer");
    } else {
      router.navigate({ to: target as never });
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, offer]);

  if (!isOpen || !offer) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-popup-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={handleDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md rounded-3xl bg-card border border-white/10 shadow-2xl overflow-hidden transition-all transform animate-in zoom-in-95 duration-300 group"
      >
        {/* Floating Close Button (X) */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close offer"
          className="absolute top-3.5 right-3.5 z-40 grid h-8 w-8 place-items-center rounded-full bg-black/75 text-white/90 shadow-lg hover:bg-black hover:text-white hover:scale-110 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Poster Image (Clickable) */}
        <div
          onClick={handleBannerClick}
          className="relative cursor-pointer select-none overflow-hidden bg-muted"
        >
          <img
            src={offer.image_url}
            alt={offer.title || "Special Offer"}
            className="w-full h-auto max-h-[75vh] object-cover object-center group-hover:scale-[1.02] transition-transform duration-500 ease-out"
            onError={(e) => {
              // Hide modal if image fails to load
              setIsOpen(false);
            }}
          />

          {/* Bottom Action Area (Gradient Overlay if CTA or Coupon exists) */}
          {(offer.button_text || offer.coupon_code) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-8 text-white space-y-2.5">
              {/* Coupon Pill */}
              {offer.coupon_code && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1.5 text-xs shadow-sm">
                  <div className="flex items-center gap-1.5 truncate">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                    <span className="text-[11px] text-slate-200 truncate">
                      Use Code:{" "}
                      <strong className="text-amber-300 font-mono tracking-wider text-xs">
                        {offer.coupon_code}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCoupon}
                    className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow hover:bg-amber-300 hover:scale-105 active:scale-95 transition-all"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy Code"}
                  </button>
                </div>
              )}

              {/* Call to Action Button */}
              {offer.button_text && (
                <button
                  type="button"
                  onClick={handleBannerClick}
                  className="w-full rounded-2xl bg-gradient-to-r from-primary to-primary/90 py-2.5 px-4 text-xs sm:text-sm font-bold text-primary-foreground shadow-xl hover:shadow-primary/25 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <span>{offer.button_text}</span>
                  <span>→</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
