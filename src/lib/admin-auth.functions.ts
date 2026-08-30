import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  id: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * Verifies the fixed admin credentials server-side, provisions the backing
 * auth user (confirmed) if needed, ensures the admin role, and returns the
 * email the browser should use for the actual sign-in.
 */
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const expectedId = process.env["ADMIN_LOGIN_ID"] ?? "AbhayTestum";
    const expectedPassword = process.env["ADMIN_LOGIN_PASSWORD"] ?? "Abhay#31";
    const email = process.env["ADMIN_LOGIN_EMAIL"] ?? `${expectedId.toLowerCase()}@testum.in`;
    if (
      !process.env["ADMIN_LOGIN_ID"] ||
      !process.env["ADMIN_LOGIN_PASSWORD"] ||
      !process.env["ADMIN_LOGIN_EMAIL"]
    ) {
      console.warn(
        "[admin-login] ADMIN_LOGIN_* env vars not set  -  using default admin credentials.",
      );
    }

    if (!safeEqual(data.id.trim(), expectedId) || !safeEqual(data.password, expectedPassword)) {
      return { ok: false as const, message: "Invalid admin ID or password." };
    }

    const SUPABASE_URL =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      "https://qievhnsketxamvlxbreb.supabase.co";
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZXZobnNrZXR4YW12bHhicmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA5NzA0NCwiZXhwIjoyMDkwNjczMDQ0fQ.j3zIPuWsqmZwZ24CBx1klOxsxpbrOlvitc3xxNAPrQg";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or create the backing auth user.
    let userId: string | null = null;
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) {
      console.error("[admin-login] listUsers failed:", listError);
      return {
        ok: false as const,
        message: "Unable to verify admin user. Please try again later.",
      };
    }

    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      userId = existing.id;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: expectedPassword,
        email_confirm: true,
      });
      if (updateError) {
        console.error("[admin-login] updateUserById failed:", updateError);
        return {
          ok: false as const,
          message: "Unable to update admin credentials. Please try again later.",
        };
      }
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: expectedPassword,
        email_confirm: true,
        user_metadata: { full_name: "Testum Admin" },
      });
      if (error || !created.user) {
        console.error("[admin-login] createUser failed:", error);
        return { ok: false as const, message: error?.message ?? "Could not create admin account." };
      }
      userId = created.user.id;
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, user_id: userId, full_name: "Testum Admin", email } as any, {
        onConflict: "user_id",
      });

    const { data: role, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) {
      console.error("[admin-login] role lookup failed:", roleError);
    }
    if (!role) {
      const { error: insertRoleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (insertRoleError) {
        console.error("[admin-login] insert role failed:", insertRoleError);
      }
    }

    return { ok: true as const, email: email.trim() };
  });
