import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, ShieldCheck, KeyRound, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Admin · Students  -  Testum" }] }),
  component: AdminStudents,
});

const PLANS = ["chapter", "part", "full", "combo"] as const;

function AdminStudents() {
  const [rows, setRows] = useState<any[]>([]);
  const [ents, setEnts] = useState<Record<string, any[]>>({});
  const [admins, setAdmins] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [grantFor, setGrantFor] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: entRows }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("entitlements").select("*"),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    const byUser: Record<string, any[]> = {};
    for (const e of entRows ?? []) (byUser[e.user_id] ||= []).push(e);
    setRows(profiles ?? []);
    setEnts(byUser);
    setAdmins(new Set((roles ?? []).map((r: any) => r.user_id)));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.full_name, r.mobile, r.student_class, r.id, r.user_id].some((v: any) =>
        String(v ?? "")
          .toLowerCase()
          .includes(t),
      ),
    );
  }, [rows, q]);

  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) return toast.error(error.message);
    }
    toast.success(makeAdmin ? "Admin access granted" : "Admin access removed");
    load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("entitlements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Access revoked");
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search students, grant free access, and manage admin roles.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, mobile or class"
          className="pl-9"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading students…
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No students found.</p>
      )}

      <div className="space-y-2">
        {filtered.map((p) => {
          const studentUserId = p.user_id || p.id;
          const list = (ents[studentUserId] ?? ents[p.id] ?? []).filter(
            (e) => !e.expires_at || new Date(e.expires_at) > new Date(),
          );
          const isAdmin = admins.has(studentUserId) || admins.has(p.id);
          return (
            <div key={p.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold">
                      {p.full_name || "Unnamed student"}
                    </span>
                    {isAdmin && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {p.mobile || "no mobile"} · {p.student_class || "class not set"} · joined{" "}
                    {new Date(p.created_at).toLocaleDateString("en-IN")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {list.length === 0 && (
                      <span className="text-xs text-muted-foreground">No active plan</span>
                    )}
                    {list.map((e) => (
                      <span
                        key={e.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-success"
                      >
                        {e.plan_code}
                        <button
                          onClick={() => revoke(e.id)}
                          aria-label={`Revoke ${e.plan_code}`}
                          className="text-destructive hover:scale-110 transition-transform"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => setGrantFor(p)}>
                    <KeyRound className="mr-1 h-3.5 w-3.5" />
                    Grant
                  </Button>
                  <Button
                    size="sm"
                    variant={isAdmin ? "secondary" : "ghost"}
                    onClick={() => toggleAdmin(studentUserId, !isAdmin)}
                  >
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    {isAdmin ? "Remove admin" : "Make admin"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <GrantDialog student={grantFor} onClose={() => setGrantFor(null)} onDone={load} />
    </div>
  );
}

function GrantDialog({
  student,
  onClose,
  onDone,
}: {
  student: any | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [plan, setPlan] = useState<string>("combo");
  const [days, setDays] = useState(365);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setBusy(true);

    const studentUserId = student.user_id || student.id;
    const expires = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;

    // Use upsert on user_id, plan_code so existing active entitlements are cleanly updated
    const { error } = await supabase.from("entitlements").upsert(
      {
        user_id: studentUserId,
        plan_code: plan as any,
        expires_at: expires,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plan_code" },
    );

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Access granted (${plan.toUpperCase()} plan)`);
    onClose();
    onDone();
  };

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant access to {student?.full_name || "student"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valid for (days, 0 = lifetime)</Label>
            <Input type="number" value={days} min={0} onChange={(e) => setDays(+e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Grant access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
