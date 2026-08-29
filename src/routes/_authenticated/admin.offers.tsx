import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Megaphone,
  Upload,
  Link as LinkIcon,
  Tag,
  Eye,
  Check,
  Copy,
  Sparkles,
  Save,
  Loader2,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Gift,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/offers")({
  head: () => ({ meta: [{ title: "Admin - Offer Popup Manager" }] }),
  component: AdminOffers,
});

interface OfferPopupData {
  id?: string;
  title: string;
  image_url: string;
  target_url: string;
  button_text: string;
  coupon_code: string;
  is_active: boolean;
  display_frequency: "once_per_session" | "once_per_day" | "always";
  target_audience: "all" | "unsubscribed_only";
}

const PRESET_TEMPLATES = [
  {
    name: "Festive Sale (Raksha Bandhan / Diwali)",
    title: "Raksha Bandhan Mega Sale",
    image_url:
      "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80",
    target_url: "/app/pricing",
    button_text: "Claim ₹2000 OFF Now",
    coupon_code: "RAKHI2000",
  },
  {
    name: "NEET 2027 Test Series Discount",
    title: "NEET 2027 Combo Pack Offer",
    image_url:
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80",
    target_url: "/app/pricing",
    button_text: "Unlock All 79+ Tests",
    coupon_code: "NEET2027",
  },
  {
    name: "Weekend Flash Sale",
    title: "Limited Time Flash Sale",
    image_url:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80",
    target_url: "/app/pricing",
    button_text: "Get Premium Access",
    coupon_code: "FLASH50",
  },
];

function AdminOffers() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OfferPopupData>({
    title: "Festive Offer",
    image_url: "",
    target_url: "/app/pricing",
    button_text: "Claim Offer Now",
    coupon_code: "FESTIVE50",
    is_active: false,
    display_frequency: "once_per_session",
    target_audience: "all",
  });

  const loadOffer = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("offer_popups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      toast.error("Failed to load offer settings: " + error.message);
    } else if (data) {
      setForm({
        id: data.id,
        title: data.title || "",
        image_url: data.image_url || "",
        target_url: data.target_url || "/app/pricing",
        button_text: data.button_text || "",
        coupon_code: data.coupon_code || "",
        is_active: !!data.is_active,
        display_frequency:
          (data.display_frequency as OfferPopupData["display_frequency"]) ||
          "once_per_session",
        target_audience:
          (data.target_audience as OfferPopupData["target_audience"]) || "all",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOffer();
  }, []);

  const handleSave = async (overrides?: Partial<OfferPopupData>) => {
    const payload = { ...form, ...overrides };

    if (!payload.image_url.trim()) {
      return toast.error("Please provide a Banner Image URL or upload an image");
    }

    setSaving(true);
    try {
      if (payload.id) {
        const { error } = await supabase
          .from("offer_popups")
          .update({
            title: payload.title,
            image_url: payload.image_url,
            target_url: payload.target_url,
            button_text: payload.button_text,
            coupon_code: payload.coupon_code,
            is_active: payload.is_active,
            display_frequency: payload.display_frequency,
            target_audience: payload.target_audience,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("offer_popups")
          .insert({
            title: payload.title,
            image_url: payload.image_url,
            target_url: payload.target_url,
            button_text: payload.button_text,
            coupon_code: payload.coupon_code,
            is_active: payload.is_active,
            display_frequency: payload.display_frequency,
            target_audience: payload.target_audience,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setForm((prev) => ({ ...prev, id: data.id }));
      }

      toast.success(
        payload.is_active
          ? "Offer Popup is now LIVE for students!"
          : "Offer settings saved (Status: Inactive)"
      );
    } catch (err: any) {
      toast.error("Failed to save offer: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.error("Please select a valid image file (PNG, JPG, WebP)");
    }

    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Image file size should be under 5MB");
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("promotions")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("promotions")
        .getPublicUrl(uploadData.path);

      setForm((prev) => ({ ...prev, image_url: publicData.publicUrl }));
      toast.success("Banner image uploaded successfully!");
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applyPreset = (preset: (typeof PRESET_TEMPLATES)[0]) => {
    setForm((prev) => ({
      ...prev,
      title: preset.title,
      image_url: preset.image_url,
      target_url: preset.target_url,
      button_text: preset.button_text,
      coupon_code: preset.coupon_code,
    }));
    toast.info(`Loaded "${preset.name}" template`);
  };

  const copyCoupon = () => {
    if (!form.coupon_code) return;
    navigator.clipboard.writeText(form.coupon_code);
    setCopied(true);
    toast.success(`Coupon code "${form.coupon_code}" copied to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearTestStorage = () => {
    sessionStorage.removeItem("testum_offer_dismissed");
    localStorage.removeItem("testum_offer_dismissed_time");
    toast.success("Popup display history reset! (You will see it again when navigating)");
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading Offer Popup settings…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Offer Popup Manager</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                form.is_active
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 animate-pulse"
                  : "bg-muted text-muted-foreground border"
              }`}
            >
              {form.is_active ? "● LIVE on Student Dashboard" : "○ Paused / Inactive"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure promotional posters, discount coupons, and clickable offer banners shown to students.
          </p>
        </div>

        {/* Global Live Toggle */}
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm shrink-0">
          <div className="text-right">
            <div className="text-xs font-semibold">Popup Visibility</div>
            <div className="text-[11px] text-muted-foreground">
              {form.is_active ? "Visible to students" : "Hidden from students"}
            </div>
          </div>
          <Switch
            checked={form.is_active}
            onCheckedChange={(checked) => {
              setForm((prev) => ({ ...prev, is_active: checked }));
              handleSave({ is_active: checked });
            }}
          />
        </div>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">How the Offer Popup Works</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When enabled, students landing on the dashboard will see a high-impact modal banner popup. 
            Students can click anywhere on the banner (or on the action button) to navigate directly to your target link (e.g. Plans & Pricing) and copy the coupon code.
          </p>
        </div>
      </div>

      {/* Main Grid: Form Controls + Live Real-time Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Presets */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" /> Quick Preset Templates
              </Label>
              <span className="text-[11px] text-muted-foreground">1-Click to prefill</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PRESET_TEMPLATES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-xl border bg-secondary/30 p-2.5 text-left text-xs font-medium hover:border-primary/50 hover:bg-secondary transition-all"
                >
                  <div className="font-semibold truncate text-foreground">{p.name.split("(")[0]}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{p.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Banner Image URL & Upload */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="image_url" className="text-sm font-semibold flex items-center gap-1.5">
                <LinkIcon className="h-4 w-4 text-primary" /> Banner Image Link / URL *
              </Label>
              <span className="text-xs text-muted-foreground">Portrait (3:4 or 4:5) recommended</span>
            </div>

            <div className="flex gap-2">
              <Input
                id="image_url"
                placeholder="https://example.com/banner-poster.jpg"
                value={form.image_url}
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                className="flex-1"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="shrink-0"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="mr-1.5 h-4 w-4" /> Upload
                  </>
                )}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              You can paste any direct web image URL (Unsplash, Imgur, Cloudinary, AWS S3, Google Drive public link) or click <strong>Upload</strong> to upload directly.
            </p>
          </div>

          {/* Campaign Details */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Gift className="h-4 w-4 text-primary" /> Campaign & Offer Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold">
                  Campaign Title / Internal Name
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Raksha Bandhan Mega Sale"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target_url" className="text-xs font-semibold">
                  Target Link (Redirect on Click)
                </Label>
                <Input
                  id="target_url"
                  placeholder="e.g. /app/pricing or https://..."
                  value={form.target_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, target_url: e.target.value }))}
                />
                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, target_url: "/app/pricing" }))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Set /app/pricing
                  </button>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, target_url: "/app/tests" }))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Set /app/tests
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coupon_code" className="text-xs font-semibold flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-amber-500" /> Coupon / Promo Code (Optional)
                </Label>
                <Input
                  id="coupon_code"
                  placeholder="e.g. RAKHI2000 or FESTIVE50"
                  value={form.coupon_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, coupon_code: e.target.value.toUpperCase() }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  Displays a 1-click copy badge on the modal.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="button_text" className="text-xs font-semibold">
                  Action Button Text (Optional)
                </Label>
                <Input
                  id="button_text"
                  placeholder="e.g. Avail Discount Now"
                  value={form.button_text}
                  onChange={(e) => setForm((prev) => ({ ...prev, button_text: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank if the image already has built-in CTA text.
                </p>
              </div>
            </div>
          </div>

          {/* Targeting & Display Rules */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-primary" /> Display Rules & Audience
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Display Frequency</Label>
                <select
                  value={form.display_frequency}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      display_frequency: e.target.value as OfferPopupData["display_frequency"],
                    }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="once_per_session">Once Per Session (Recommended)</option>
                  <option value="once_per_day">Once Every 24 Hours</option>
                  <option value="always">Always (Every Page Visit / Testing)</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Prevents annoying students by respecting their dismissal.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <select
                  value={form.target_audience}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      target_audience: e.target.value as OfferPopupData["target_audience"],
                    }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Students</option>
                  <option value="unsubscribed_only">Only Free / Unsubscribed Students</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Target students who haven't purchased full access yet.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              size="lg"
              onClick={() => handleSave()}
              disabled={saving}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Offer Configuration
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={clearTestStorage}
              className="shrink-0"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Reset My View History
            </Button>
          </div>
        </div>

        {/* Right Column: Live Interactive Student View Mockup (5 cols) */}
        <div className="lg:col-span-5 space-y-3 sticky top-20">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" /> Live Student View Preview
            </Label>
            <span className="text-[11px] text-muted-foreground">Simulated student screen</span>
          </div>

          {/* Device Mockup Wrapper */}
          <div className="relative rounded-3xl border-4 border-slate-800 bg-slate-900 shadow-2xl p-2.5 overflow-hidden">
            {/* Top Device Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-800">
              <div className="font-semibold text-slate-200">TrackPrep / Testum</div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Student Mode</span>
              </div>
            </div>

            {/* Mocked Student Dashboard Background */}
            <div className="relative min-h-[460px] bg-background p-4 rounded-2xl overflow-hidden select-none">
              {/* Background Mock Elements (blurred dashboard) */}
              <div className="space-y-3 opacity-30 pointer-events-none">
                <div className="h-16 rounded-xl bg-primary/20" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-14 rounded-xl bg-card border" />
                  <div className="h-14 rounded-xl bg-card border" />
                </div>
                <div className="h-28 rounded-xl bg-card border" />
              </div>

              {/* Modal Backdrop Simulation */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 flex items-center justify-center p-3">
                {/* Simulated Modal Card */}
                <div className="relative w-full max-w-[320px] rounded-2xl bg-card border shadow-2xl overflow-hidden transition-all duration-300 transform scale-100 animate-in fade-in zoom-in-95">
                  {/* Close button (X) */}
                  <button
                    type="button"
                    onClick={() => toast.info("Close 'X' button clicked")}
                    className="absolute top-2.5 right-2.5 z-30 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white shadow-md hover:bg-black transition-all"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Banner Image */}
                  <div className="relative aspect-[4/5] w-full bg-muted overflow-hidden">
                    {form.image_url ? (
                      <img
                        src={form.image_url}
                        alt={form.title || "Offer Banner"}
                        className="h-full w-full object-cover object-center"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "https://placehold.co/600x750/orange/white?text=Invalid+Image+URL";
                        }}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-muted-foreground">
                        <Megaphone className="h-10 w-10 text-muted-foreground/40 mb-2" />
                        <p className="text-xs font-semibold">No Image Provided</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Enter an image URL or click Upload
                        </p>
                      </div>
                    )}

                    {/* Gradient Overlay at Bottom */}
                    {(form.button_text || form.coupon_code) && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 text-white space-y-2">
                        {/* Coupon code badge if set */}
                        {form.coupon_code && (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 text-xs">
                            <span className="text-[11px] text-slate-200">
                              Code: <strong className="text-amber-300 font-mono tracking-wider">{form.coupon_code}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={copyCoupon}
                              className="inline-flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950 hover:bg-amber-300"
                            >
                              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {copied ? "Copied" : "Copy"}
                            </button>
                          </div>
                        )}

                        {/* CTA button if text provided */}
                        {form.button_text && (
                          <a
                            href={form.target_url || "#"}
                            onClick={(e) => {
                              e.preventDefault();
                              toast.success(`Redirecting to: ${form.target_url}`);
                            }}
                            className="block w-full text-center rounded-xl bg-primary py-2 px-3 text-xs font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
                          >
                            {form.button_text} →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Simulated Home Bar */}
            <div className="mt-2 flex justify-center">
              <div className="h-1 w-24 rounded-full bg-slate-700" />
            </div>
          </div>

          <div className="rounded-xl border bg-secondary/20 p-3 text-center text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Students can click on the banner poster, button, or copy the coupon directly.
          </div>
        </div>
      </div>
    </div>
  );
}
