import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

export function cleanMobileNumber(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function getFriendlyAuthError(msg: string): string {
  if (!msg) return "Authentication failed. Please try again.";
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Your email is not confirmed yet. Please check your inbox or spam folder.";
  }
  if (lower.includes("already registered") || lower.includes("user already exists")) {
    return "This email is already registered. Please sign in instead.";
  }
  if (lower.includes("password should be at least") || lower.includes("password must be")) {
    return "Password must be at least 8 characters long.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Network error. Please check your internet connection and try again.";
  }
  return msg;
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  mobile: z.string().refine((val) => /^[6-9]\d{9}$/.test(cleanMobileNumber(val)), {
    message: "Enter a valid 10-digit Indian mobile number",
  }),
  studentClass: z.enum(["11th", "12th", "dropper"], { message: "Select your class" }),
});

export function AuthForm({
  defaultTab = "signin",
  onSuccess,
  redirectTo = "/app",
}: {
  defaultTab?: "signin" | "signup";
  onSuccess?: () => void;
  redirectTo?: string;
}) {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">(defaultTab);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [studentClass, setStudentClass] = useState<"11th" | "12th" | "dropper" | "">("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = cleanMobileNumber(e.target.value);
    setMobile(cleaned);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const navigateToDestination = async () => {
    try {
      await router.invalidate();
    } catch {
      // ignore
    }
    const target = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("/auth") ? redirectTo : "/app";
    router.navigate({ to: target as any, replace: true });
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter your email address");
      return;
    }
    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        toast.error(getFriendlyAuthError(error.message));
        return;
      }

      if (data?.session || data?.user) {
        toast.success("Welcome back!");
        onSuccess?.();
        await navigateToDestination();
      }
    } catch (err: any) {
      toast.error(getFriendlyAuthError(err?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const cleanedMobile = cleanMobileNumber(mobile);
    const parsed = signUpSchema.safeParse({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      mobile: cleanedMobile,
      studentClass,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }

    setBusy(true);
    try {
      const redirectOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: redirectOrigin,
          data: {
            full_name: parsed.data.name,
            mobile: cleanedMobile,
            student_class: parsed.data.studentClass,
          },
        },
      });

      if (error) {
        toast.error(getFriendlyAuthError(error.message));
        return;
      }

      // Check if user already exists (Supabase returns empty identities array without throwing an error)
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        toast.error("This email is already registered. Please sign in instead.");
        setActiveTab("signin");
        return;
      }

      if (!data?.session) {
        toast.success("Account created! Please check your email to confirm, then sign in.");
        setActiveTab("signin");
        return;
      }

      toast.success("Account created - welcome to Testum!");
      onSuccess?.();
      await navigateToDestination();
    } catch (err: any) {
      toast.error(getFriendlyAuthError(err?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "signup")}>
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="signin" className="text-sm font-medium">Sign in</TabsTrigger>
          <TabsTrigger value="signup" className="text-sm font-medium">Sign up</TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="mt-0 focus-visible:outline-none">
          <form onSubmit={signIn} className="space-y-4" noValidate={false}>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="signin-email">Email address</Label>
              <Input
                id="signin-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={email}
                onChange={handleEmailChange}
                placeholder="name@example.com"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <Label htmlFor="signin-password">Password</Label>
              <div className="relative">
                <Input
                  id="signin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 h-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold shadow-sm" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup" className="mt-0 focus-visible:outline-none">
          <form onSubmit={signUp} className="space-y-3.5 text-left" noValidate={false}>
            <div className="space-y-1.5">
              <Label htmlFor="signup-name">Full name</Label>
              <Input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aarav Sharma"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email address</Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={email}
                onChange={handleEmailChange}
                placeholder="name@example.com"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-class">Target Class</Label>
              <Select value={studentClass} onValueChange={(v) => setStudentClass(v as typeof studentClass)}>
                <SelectTrigger id="signup-class" className="h-10">
                  <SelectValue placeholder="Select your class" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="11th">Class 11th (NEET 2027)</SelectItem>
                  <SelectItem value="12th">Class 12th (NEET 2026/2027)</SelectItem>
                  <SelectItem value="dropper">Dropper / Repeater</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-mobile">Mobile number</Label>
              <div className="flex gap-2">
                <div className="flex h-10 items-center justify-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground select-none font-medium">
                  +91
                </div>
                <Input
                  id="signup-mobile"
                  name="tel"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={handleMobileChange}
                  placeholder="9876543210"
                  className="h-10 flex-1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password (min 8 chars)</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 h-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold shadow-sm mt-2" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function AuthDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen,
  defaultTab = "signin",
  onOpen,
  redirectTo = "/app",
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  defaultTab?: "signin" | "signup";
  onOpen?: () => void;
  redirectTo?: string;
}) {
  const isControlled = typeof controlledOpen === "boolean";
  const [internalOpen, setInternalOpen] = useState(!!defaultOpen);
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    controlledOnOpenChange?.(newOpen);
    if (newOpen) {
      onOpen?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[94vw] sm:max-w-md max-h-[90dvh] overflow-y-auto p-5 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="font-display text-2xl">Welcome to Testum</DialogTitle>
          <DialogDescription>Sign in or create an account to start your NEET prep.</DialogDescription>
        </DialogHeader>

        <AuthForm
          defaultTab={defaultTab}
          redirectTo={redirectTo}
          onSuccess={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
