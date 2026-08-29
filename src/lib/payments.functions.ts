import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PlanCode = z.enum(["chapter", "part", "full", "combo"]);

/**
 * Resolve the Cashfree environment. The secret key itself encodes the
 * environment (`cfsk_ma_prod_…` vs `cfsk_ma_test_…`), so trust it first and
 * only fall back to CASHFREE_ENV  -  a mismatched env value is the classic
 * cause of Cashfree "authentication error" responses.
 */
function cfEnv(): "production" | "sandbox" {
  const key = (process.env["CASHFREE_SECRET_KEY"] ?? "").toLowerCase();
  if (key.includes("_prod_")) return "production";
  if (key.includes("_test_")) return "sandbox";
  const env = (process.env["CASHFREE_ENV"] ?? "sandbox").toLowerCase();
  return env === "prod" || env === "production" ? "production" : "sandbox";
}

function cfBase() {
  return cfEnv() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function cfHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-version": "2023-08-01",
    "x-client-id": (process.env["CASHFREE_APP_ID"] ?? "").trim(),
    "x-client-secret": (process.env["CASHFREE_SECRET_KEY"] ?? "").trim(),
  };
}

/** Creates a Cashfree order and returns a payment session id for the JS checkout. */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planCode: PlanCode, returnUrl: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    if (!process.env["CASHFREE_APP_ID"] || !process.env["CASHFREE_SECRET_KEY"]) {
      throw new Error("Payment gateway is not configured yet.");
    }

    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("code, title, price_inr")
      .eq("code", data.planCode)
      .maybeSingle();
    if (planErr || !plan) throw new Error("Plan not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, mobile")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    const userMetadata = (claims as any)?.user_metadata ?? {};
    const rawMobile =
      profile?.mobile ||
      userMetadata.mobile ||
      userMetadata.phone ||
      (claims as any)?.phone ||
      "";

    const phone = rawMobile.replace(/\D/g, "").slice(-10) || "9999999999";
    const customerName =
      profile?.full_name ||
      userMetadata.full_name ||
      userMetadata.name ||
      ((claims as { email?: string })?.email?.split("@")[0] ?? "Testum Student");
    const customerEmail =
      (claims as { email?: string })?.email ||
      userMetadata.email ||
      "student@testum.in";

    const cfOrderId = `TESTUM_${data.planCode}_${Date.now()}_${userId.slice(0, 8)}`;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        plan_code: data.planCode,
        amount_inr: plan.price_inr,
        cf_order_id: cfOrderId,
      })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Could not create order");

    const res = await fetch(`${cfBase()}/orders`, {
      method: "POST",
      headers: cfHeaders(),
      body: JSON.stringify({
        order_id: cfOrderId,
        order_amount: Number(plan.price_inr),
        order_currency: "INR",
        customer_details: {
          customer_id: userId.replace(/-/g, ""),
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: phone,
        },
        order_meta: {
          // Cashfree production requires an HTTPS return_url.
          // Use APP_URL env var in production; fall back gracefully for local dev.
          return_url: (() => {
            const base = (process.env["APP_URL"] ?? data.returnUrl).replace(/\/$/, "");
            // If still localhost, omit return_url so Cashfree doesn't error.
            const isLocal = base.includes("localhost") || base.includes("127.0.0.1");
            return isLocal ? undefined : `${base}?order_id=${cfOrderId}`;
          })(),
        },
        order_note: plan.title,
      }),
    });

    const body = (await res.json()) as { payment_session_id?: string; message?: string; type?: string };
    if (!res.ok || !body.payment_session_id) {
      console.error("[cashfree] order create failed", res.status, body);
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      await admin.from("orders").update({ status: "failed", raw: body as never }).eq("id", order.id);
      throw new Error(body.message ?? "Could not start payment. Please try again.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("orders")
      .update({ cf_payment_session_id: body.payment_session_id })
      .eq("id", order.id);

    return {
      paymentSessionId: body.payment_session_id,
      cfOrderId,
      env: cfEnv(),
    };
  });

/** Confirms payment with Cashfree after redirect and grants the entitlement. */
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cfOrderId: z.string().min(4) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, plan_code, status")
      .eq("cf_order_id", data.cfOrderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("Order not found");
    if (order.status === "paid") return { status: "paid" as const, planCode: order.plan_code };

    const res = await fetch(`${cfBase()}/orders/${data.cfOrderId}`, { headers: cfHeaders() });
    const body = (await res.json()) as { order_status?: string };
    const paid = body.order_status === "PAID";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("orders")
      .update({ status: paid ? "paid" : "failed", raw: body as never })
      .eq("id", order.id);

    if (paid) {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      await supabaseAdmin.from("entitlements").upsert(
        {
          user_id: userId,
          plan_code: order.plan_code,
          order_id: order.id,
          expires_at: expires.toISOString(),
        },
        { onConflict: "user_id,plan_code" },
      );
    }

    return { status: paid ? ("paid" as const) : ("pending" as const), planCode: order.plan_code };
  });
