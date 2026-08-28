import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  studentClass: z.enum(["11th", "12th", "dropper"], { message: "Select your class" }),
});

export function AuthDialog({ trigger, defaultOpen, defaultTab = "signin" }: { trigger?: React.ReactNode; defaultOpen?: boolean; defaultTab?: "signin" | "signup" }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">(defaultTab);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [studentClass, setStudentClass] = useState<"11th" | "12th" | "dropper" | "">("");

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setActiveTab(defaultTab);
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      return;
    }
    toast.success("Welcome back!");
    setOpen(false);
    router.navigate({ to: "/app" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ name, email, password, mobile, studentClass });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.name,
          mobile: parsed.data.mobile,
          student_class: parsed.data.studentClass,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already registered") ? "This email is already registered  -  sign in instead." : error.message);
      return;
    }
    if (!data.session) {
      toast.success("Account created  -  check your email to confirm, then sign in.");
      return;
    }
    toast.success("Account created  -  you're in!");
    setOpen(false);
    router.navigate({ to: "/app" });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Welcome to Testum</DialogTitle>
          <DialogDescription>Sign in to start your NEET 2027 prep.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "signup")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-3 pt-3">
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" className="w-full h-11" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sign in</Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-3 pt-3">
              <div><Label>Full name</Label><Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" /></div>
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div>
                <Label>Class</Label>
                <Select value={studentClass} onValueChange={(v) => setStudentClass(v as typeof studentClass)}>
                  <SelectTrigger><SelectValue placeholder="Select your class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dropper">Dropper</SelectItem>
                    <SelectItem value="11th">11th</SelectItem>
                    <SelectItem value="12th">12th</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Mobile number</Label><Input type="tel" inputMode="numeric" required maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} placeholder="9876543210" /></div>
              <div><Label>Password (min 8)</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" className="w-full h-11" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create account</Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
