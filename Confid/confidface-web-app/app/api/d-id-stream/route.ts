import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

/**
 * D-ID Streaming Avatar for Interview Questions
 * Creates a streaming avatar session that speaks the interview questions
 */
export async function POST(req: NextRequest) {
  try {
    const { script } = await req.json();

    if (!script) {
      return NextResponse.json(
        { error: "Missing script parameter" },
        { status: 400 }
      );
    }

    const apiKey = process.env.D_ID_API_KEY!;
    const encodedKey = Buffer.from(`${apiKey}:`).toString("base64");

    // Create D-ID streaming session for the interview script
    const didResponse = await axios.post(
      "https://api.d-id.com/talks/streams",
      {
        // Use a professional avatar image for interviews
        source_url:
          "https://ik.imagekit.io/4tljpfyal/premium_photo-1690407617542-2f210cf20d7e.jpg",
        script: {
          type: "text",
          input: script,
          provider: {
            type: "microsoft",
            voice_id: "en-US-JennyNeural", // Professional voice for interviews
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${encodedKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ D-ID Stream created:", {
      streamId: didResponse.data?.id,
      status: didResponse.data?.status,
    });

    // Return stream data including offer for WebRTC
    return NextResponse.json({
      success: true,
      id: didResponse.data?.id,
      offer: didResponse.data?.offer,
      ice_servers: didResponse.data?.ice_servers,
      session_id: didResponse.data?.session_id,
    });
  } catch (error: any) {
    console.error("❌ D-ID Stream creation ERROR:", error.response?.data || error.message);
    return NextResponse.json(
      {
        error: "Failed to create D-ID stream",
        details: error.response?.data?.error || error.message,
      },
      { status: error.response?.status || 500 }
    );
  }
}

/**
 * Fetch stream status
 */
export async function GET(req: NextRequest) {
  try {
    const streamId = req.nextUrl.searchParams.get("streamId");

    if (!streamId) {
      return NextResponse.json(
        { error: "Missing streamId parameter" },
        { status: 400 }
      );
    }

    const apiKey = process.env.D_ID_API_KEY!;
    const auth = Buffer.from(`${apiKey}:`).toString("base64");

    // Get stream status from D-ID
    const response = await axios.get(
      `https://api.d-id.com/talks/streams/${streamId}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Stream status retrieved:", {
      streamId,
      status: response.data?.status,
    });

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error("❌ D-ID Stream fetch ERROR:", error.response?.data || error.message);
    return NextResponse.json(
      {
        error: "Failed to fetch stream data",
        details: error.response?.data?.error || error.message,
      },
      { status: error.response?.status || 500 }
    );
  }
}
