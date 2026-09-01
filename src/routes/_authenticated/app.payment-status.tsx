import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPayment } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/payment-status")({
  ssr: false,
  head: () => ({ meta: [{ title: "Payment status  -  Testum" }] }),
  component: PaymentStatus,
});

function PaymentStatus() {
  const navigate = useNavigate();
  const verify = useServerFn(verifyPayment);
  const [state, setState] = useState<"checking" | "paid" | "pending" | "error">("checking");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const cfOrderId = new URLSearchParams(window.location.search).get("order_id");
    if (!cfOrderId) { setState("error"); setMessage("No order reference found."); return; }
    (async () => {
      try {
        const res = await verify({ data: { cfOrderId } });
        setState(res.status === "paid" ? "paid" : "pending");
      } catch (e: any) {
        setState("error");
        setMessage(e?.message ?? "Could not verify payment");
      }
    })();
  }, [verify]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
      <div className="w-full rounded-3xl border bg-card p-8 text-center shadow-elegant">
        {state === "checking" && (<>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <h1 className="mt-4 font-display text-xl font-bold">Confirming your payment…</h1>
          <p className="mt-1 text-sm text-muted-foreground">Please don't close this page.</p>
        </>)}
        {state === "paid" && (<>
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-4 font-display text-xl font-bold">Payment successful 🎉</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your test series is unlocked.</p>
          <Button className="mt-6 h-11 w-full" onClick={() => navigate({ to: "/app/tests" })}>Start a test</Button>
        </>)}
        {(state === "pending" || state === "error") && (<>
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 font-display text-xl font-bold">{state === "pending" ? "Payment not completed" : "Something went wrong"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{message || "If money was deducted it will reflect within a few minutes, or be refunded automatically."}</p>
          <Button asChild className="mt-6 h-11 w-full"><Link to="/app/pricing">Back to plans</Link></Button>
        </>)}
      </div>
    </div>
  );
}
