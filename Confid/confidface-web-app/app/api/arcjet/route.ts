import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/next";
import { isSpoofedBot } from "@arcjet/inspect";
import { NextResponse } from "next/server";
import { aj } from "@/utils/arcjet";



export async function GET(req: Request) {
  const userId = "user123";

  // Wrap the Next.js Request into an adapter that provides getBody() as required by ArcjetAdapterContext.
  const arcjetCtx = {
    getBody: async () => {
      try {
        // clone() may not exist in all runtimes; if available, use it to avoid consuming the original request body
        const r = typeof (req as any).clone === "function" ? (req as any).clone() : req;
        const text = await r.text();
        // return undefined for empty bodies to match Arcjet's expectation of optional body
        return text === "" ? undefined : text;
      } catch {
        return undefined;
      }
    },
    // include some common fields Arcjet might inspect (kept generic)
    headers: req.headers,
    method: req.method,
    url: req.url,
  };

  const decision = await aj.protect(arcjetCtx as any, { userId, requested: 5 }); // Deduct 5 tokens from the bucket
  console.log("Arcjet decision", decision);

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        { error: "Too Many Requests", reason: decision.reason },
        { status: 429 },
      );
    } else if (decision.reason.isBot()) {
      return NextResponse.json(
        { error: "No bots allowed", reason: decision.reason },
        { status: 403 },
      );
    } else {
      return NextResponse.json(
        { error: "Forbidden", reason: decision.reason },
        { status: 403 },
      );
    }
  }

  // Requests from hosting IPs are likely from bots, so they can usually be
  // blocked. However, consider your use case - if this is an API endpoint
  // then hosting IPs might be legitimate.
  // https://docs.arcjet.com/blueprints/vpn-proxy-detection
  if (decision.ip.isHosting()) {
    return NextResponse.json(
      { error: "Forbidden", reason: decision.reason },
      { status: 403 },
    );
  }

  // Paid Arcjet accounts include additional verification checks using IP data.
  // Verification isn't always possible, so we recommend checking the decision
  // separately.
  // https://docs.arcjet.com/bot-protection/reference#bot-verification
  if (decision.results.some(isSpoofedBot)) {
    return NextResponse.json(
      { error: "Forbidden", reason: decision.reason },
      { status: 403 },
    );
  }

  return NextResponse.json({ message: "Hello world" });
}