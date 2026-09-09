import { NextResponse } from "next/server";
import { getState, StoreNotConfiguredError } from "../../../lib/store";
import { computeRemainingSeconds } from "../../../lib/timer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getState();
    return NextResponse.json(
      { ...state, timer: { ...state.timer, remainingSeconds: computeRemainingSeconds(state.timer) } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof StoreNotConfiguredError) {
      return NextResponse.json({ error: "store_not_configured", message: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "server_error", message: String(err.message || err) }, { status: 500 });
  }
}
