import { NextRequest, NextResponse } from "next/server";

// Free alternative using client-side Web Speech API
// This is a simple pass-through that validates the audio was sent

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const audioBase64 = body.audio;

    if (!audioBase64) {
      return NextResponse.json(
        { error: "No audio data provided" },
        { status: 400 }
      );
    }

    // Note: Actual transcription should be done on client-side using Web Speech API
    // This endpoint can be used for any future backend processing if needed
    return NextResponse.json({
      success: true,
      message: "Audio received. Use Web Speech API on client for transcription.",
    });
  } catch (err: any) {
    console.error("[speech-to-text] Error:", err?.message || err);
    return NextResponse.json(
      {
        error: "Failed to process audio",
        details: err?.message,
      },
      { status: 500 }
    );
  }
}
