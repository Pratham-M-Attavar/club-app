import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type BookingRecord = {
  id: string;
  building_id?: string;
  flat_number?: string;
  category?: string;
  vendor_id?: string;
  resident_id?: string;
  booked_by?: string;
  slot_time?: string;
  note?: string;
  status?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formatSlot(slotTime?: string) {
  if (!slotTime) return "Time not set yet";
  return new Date(slotTime).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
) {
  if (!tokens.length) return { sent: 0 };

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId: "bookings",
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const result = await res.json();
  const sent = Array.isArray(result.data)
    ? result.data.filter((r: { status?: string }) => r.status === "ok").length
    : 0;

  return { sent, raw: result };
}

async function loadBookingDetails(admin: ReturnType<typeof createClient>, record: BookingRecord) {
  let vendorName = record.category ?? "Service";
  if (record.vendor_id) {
    const { data: vendor } = await admin
      .from("vendors")
      .select("name, category")
      .eq("id", record.vendor_id)
      .maybeSingle();
    vendorName = vendor?.name ?? vendor?.category ?? "Vendor";
  }

  let residentLabel = `Flat ${record.flat_number ?? "?"}`;
  const residentId = record.resident_id ?? record.booked_by;
  if (residentId) {
    const { data: resident } = await admin
      .from("profiles")
      .select("full_name, flat_number")
      .eq("id", residentId)
      .maybeSingle();
    if (resident) {
      residentLabel = `${resident.full_name ?? "Resident"} · Flat ${resident.flat_number ?? record.flat_number ?? "?"}`;
    }
  }

  return {
    vendorName,
    residentLabel,
    whenLabel: formatSlot(record.slot_time),
    noteLabel: record.note?.trim() || "",
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const payload = await req.json();
  const bookingId = payload.booking_id as string | undefined;
  if (!bookingId) {
    return jsonResponse({ error: "booking_id required" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: booking, error: bookingError } = await admin
    .from("vendor_bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return jsonResponse({ error: "Booking not found" }, 404);
  }

  const callerId = authData.user.id;
  const isCaller =
    booking.resident_id === callerId ||
    booking.booked_by === callerId;

  if (!isCaller) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const createdAt = booking.created_at ? new Date(booking.created_at).getTime() : 0;
  const isRecent = Date.now() - createdAt < 5 * 60 * 1000;
  if (!isRecent) {
    return jsonResponse({ error: "Booking notification window expired" }, 403);
  }

  const { data: operators, error: operatorError } = await admin
    .from("profiles")
    .select("push_token, full_name")
    .or("is_operator.eq.true,is_admin.eq.true,role.eq.admin")
    .not("push_token", "is", null);

  if (operatorError) {
    return jsonResponse({ error: operatorError.message }, 500);
  }

  const operatorTokens = (operators ?? [])
    .map((row) => row.push_token)
    .filter(Boolean);

  if (!operatorTokens.length) {
    return jsonResponse({
      ok: true,
      results: {
        push: {
          skipped: true,
          reason: "Operator has no push token — open the app on your phone and allow notifications",
        },
      },
    });
  }

  const { vendorName, residentLabel, whenLabel, noteLabel } =
    await loadBookingDetails(admin, booking as BookingRecord);

  const title = "New vendor booking";
  const body = noteLabel
    ? `${residentLabel} · ${vendorName} · ${whenLabel} · ${noteLabel}`
    : `${residentLabel} · ${vendorName} · ${whenLabel}`;

  const push = await sendExpoPush(operatorTokens, title, body, {
    booking_id: booking.id,
    type: "vendor_booking",
  });

  return jsonResponse({ ok: true, results: { push } });
});
