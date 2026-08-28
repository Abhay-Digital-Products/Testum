import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/cashfree-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-webhook-signature") ?? "";
        const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
        const secret = process.env["CASHFREE_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const expected = createHmac("sha256", secret).update(timestamp + raw).digest("base64");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const cfOrderId: string | undefined = payload?.data?.order?.order_id;
        const status: string | undefined = payload?.data?.payment?.payment_status;
        if (!cfOrderId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, user_id, plan_code, status")
          .eq("cf_order_id", cfOrderId)
          .maybeSingle();
        if (!order) return new Response("ok");

        if (status === "SUCCESS") {
          await supabaseAdmin
            .from("orders")
            .update({ status: "paid", raw: payload })
            .eq("id", order.id);
          const expires = new Date();
          expires.setFullYear(expires.getFullYear() + 1);
          await supabaseAdmin.from("entitlements").upsert(
            {
              user_id: order.user_id,
              plan_code: order.plan_code,
              order_id: order.id,
              expires_at: expires.toISOString(),
            },
            { onConflict: "user_id,plan_code" },
          );
        } else if (status === "FAILED" || status === "USER_DROPPED") {
          await supabaseAdmin.from("orders").update({ status: "failed", raw: payload }).eq("id", order.id);
        }

        return new Response("ok");
      },
    },
  },
});
