import { NextRequest, NextResponse } from "next/server";

// Free alternative using client-side Web Speech API
// This is a simple validation endpoint

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    // Note: Actual text-to-speech should be done on client-side using Web Speech API
    // This endpoint can be used for any future backend processing if needed
    return NextResponse.json({
      success: true,
      message: "Text received. Use Web Speech API on client for synthesis.",
    });
  } catch (err: any) {
    console.error("[text-to-speech] Error:", err?.message || err);
    return NextResponse.json(
      {
        error: "Failed to process text",
        details: err?.message,
      },
      { status: 500 }
    );
  }
}
