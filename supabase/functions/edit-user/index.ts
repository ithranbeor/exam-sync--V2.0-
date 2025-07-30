/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Only POST allowed" }), {
      status: 405,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      user_id,
      first_name,
      last_name,
      middle_name,
      email_address,
      contact_number,
      status,
    } = body;

    // Validate required fields
    if (
      !user_id ||
      !first_name ||
      !last_name ||
      !email_address ||
      !contact_number ||
      !status
    ) {
      return new Response(JSON.stringify({ message: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

    // Try to avoid recursion — only update if values have changed
    const { data: existingUser, error: fetchError } = await supabase
      .from("tbl_users")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (fetchError) {
      console.error("Fetch user failed:", fetchError);
      return new Response(JSON.stringify({ message: "User not found or fetch failed" }), {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const updates: any = {};
    if (first_name !== existingUser.first_name) updates.first_name = first_name;
    if (last_name !== existingUser.last_name) updates.last_name = last_name;
    if (middle_name !== existingUser.middle_name) updates.middle_name = middle_name;
    if (email_address !== existingUser.email_address) updates.email_address = email_address;
    if (contact_number !== existingUser.contact_number) updates.contact_number = contact_number;
    if (normalizedStatus !== existingUser.status) updates.status = normalizedStatus;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ message: "No changes to update" }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("tbl_users")
      .update(updates)
      .eq("user_id", user_id);

    if (updateError) {
      console.error("DB Update Error:", updateError);
      return new Response(
        JSON.stringify({
          message: "Failed to update user",
          error: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ message: "User updated successfully" }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({
        message: "Unexpected server error",
        error:
          typeof err === "object" && err !== null && "message" in err
            ? err.message
            : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
