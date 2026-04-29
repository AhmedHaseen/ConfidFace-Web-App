import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handle SDP answer for D-ID streaming avatar
 */
export async function POST(req: NextRequest) {
  try {
    const { streamId, sessionId, answer } = await req.json();

    console.log("D-ID SDP payload:", {
      streamId,
      sessionId: sessionId?.substring(0, 20) + "...",
      sdpLength: answer?.sdp?.length,
    });

    if (!streamId || !sessionId || !answer?.sdp) {
      return NextResponse.json(
        { error: "Missing streamId, sessionId, or answer.sdp" },
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
      console.log("Parsed Cookie header for SDP");
    }

    const resp = await axios.post(
      `https://api.d-id.com/talks/streams/${streamId}/sdp`,
      { answer },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
      }
    );

    console.log("✅ D-ID SDP response: success");
    return NextResponse.json(resp.data);
  } catch (error: any) {
    console.error(
      "D-ID SDP ERROR:",
      error.response?.data || error.message
    );
    const status = error.response?.status || 500;
    const details = error.response?.data || "D-ID SDP failed";
    const errorMessage =
      typeof details === "string" ? details : JSON.stringify(details);
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
