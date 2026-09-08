import { NextResponse } from "next/server";
import { getState, BlobNotConfiguredError } from "../../../lib/store";
import { ADMIN_PIN } from "../../../lib/gameData";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const pin = request.headers.get("x-admin-pin");
  if (pin !== ADMIN_PIN) {
    return NextResponse.json({ error: "unauthorized", message: "Wrong PIN" }, { status: 401 });
  }
  try {
    const state = await getState();
    return NextResponse.json(
      { events: state.events || [], exportedAt: Date.now() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof BlobNotConfiguredError) {
      return NextResponse.json({ error: "blob_not_configured", message: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "server_error", message: String(err.message || err) }, { status: 500 });
  }
}
