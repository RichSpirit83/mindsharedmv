import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await adminClient.auth.getUser(token);
    if (!caller) throw new Error("Unauthorized");

    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Admin access required");

    const { action, email, userId, role } = await req.json();

    if (action === "invite") {
      if (!email) throw new Error("Email is required");
      // Create user with a random password (they'll reset via email)
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID(),
      });
      if (error) throw error;

      // Assign role
      const assignRole = role || "viewer";
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: data.user.id, role: assignRole });
      if (roleError) throw roleError;

      return new Response(JSON.stringify({ success: true, user_id: data.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set-password") {
      if (!userId) throw new Error("userId is required");
      const { password } = await req.json().catch(() => ({ password: undefined }));
      const pwd = password || (await req.json().catch(() => ({}))).password;
      if (!email && !userId) throw new Error("userId is required");
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password: password ?? pwd });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!userId) throw new Error("userId is required");
      if (userId === caller.id) throw new Error("Cannot delete your own account");
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("manage-users error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
