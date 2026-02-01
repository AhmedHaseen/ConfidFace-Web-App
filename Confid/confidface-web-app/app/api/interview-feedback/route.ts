import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const result = await axios.post(
    "http://localhost:5678/webhook/6b59b861-b232-41e5-b5ca-e2885ddefce2",
    {
      messages: JSON.stringify(messages),
    }
  );
  console.log("Raw webhook response:", result.data);

  // Gemini-style response: JSON string wrapped inside content.parts[0].text
  const rawText = result?.data?.content?.parts?.[0]?.text ?? null;

  if (!rawText) {
    return NextResponse.json(
      { error: "No response text from webhook" },
      { status: 400 }
    );
  }

  // Strip markdown code fences (```json ... ```)
  const cleanJson = rawText
    .replace(/```(?:json)?\n?/gi, "") // Remove opening fence
    .replace(/\n?```/g, "") // Remove closing fence
    .trim();

  console.log("Cleaned JSON:", cleanJson);

  try {
    const parsed = JSON.parse(cleanJson);
    console.log("Parsed feedback:", parsed);

    // Return only the necessary fields
    return NextResponse.json(
      {
        feedback: parsed.feedback,
        suggestion: parsed.suggestion,
        rating: parsed.rating,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to parse feedback JSON:", error);
    return NextResponse.json(
      { error: "Failed to parse feedback response" },
      { status: 500 }
    );
  }
}
