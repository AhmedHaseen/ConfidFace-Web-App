import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handle ICE candidates for D-ID streaming avatar
 */
export async function POST(req: NextRequest) {
  try {
    const { streamId, sessionId, candidate } = await req.json();

    if (!streamId || !sessionId || !candidate) {
      return NextResponse.json(
        { error: "Missing streamId, sessionId, or candidate" },
        { status: 400 }
      );
    }

    const apiKey = process.env.D_ID_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing D_ID_API_KEY" },
        { status: 500 }
      );
    }

    // Parse cookie string if needed
    let cookieHeader = sessionId;
    if (sessionId && sessionId.includes(";")) {
      const cookies: string[] = [];
      const parts = sessionId.split(";");
      for (const part of parts) {
        const trimmed = part.trim();
        if (
          trimmed.includes("=") &&
          !trimmed.includes("Expires") &&
          !trimmed.includes("Path") &&
          !trimmed.includes("Domain") &&
          !trimmed.includes("SameSite") &&
          !trimmed.includes("Secure")
        ) {
          cookies.push(trimmed);
        }
      }
      cookieHeader = cookies.join("; ");
    }

    const resp = await axios.post(
      `https://api.d-id.com/talks/streams/${streamId}/ice`,
      { candidate },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
      }
    );

    return NextResponse.json(resp.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const details = error.response?.data || error.message;
    console.error("D-ID ICE error:", details);
    return NextResponse.json(
      { error: "D-ID ICE failed", details },
      { status }
    );
  }
}
