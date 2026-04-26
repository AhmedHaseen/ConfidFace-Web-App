import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  
  console.log("💬 Sending messages to n8n feedback webhook:", 
    Array.isArray(messages) ? `${messages.length} messages` : typeof messages
  );

  const result = await axios.post(
    "http://localhost:5678/webhook/6b59b861-b232-41e5-b5ca-e2885ddefce2",
    {
      messages: typeof messages === 'string' ? messages : JSON.stringify(messages),
    }
  );
  console.log("Raw webhook response:", JSON.stringify(result.data).substring(0, 500));

  // Try to extract text from various n8n response formats
  let rawText: string | null = null;

  // Format 1: Gemini-style { content: { parts: [{ text: "..." }] } }
  if (result?.data?.content?.parts?.[0]?.text) {
    rawText = result.data.content.parts[0].text;
  }
  // Format 2: Direct text field
  else if (typeof result?.data?.text === 'string') {
    rawText = result.data.text;
  }
  // Format 3: output field (some n8n nodes)
  else if (typeof result?.data?.output === 'string') {
    rawText = result.data.output;
  }
  // Format 4: Already a JSON object with feedback fields
  else if (result?.data?.feedback || result?.data?.rating) {
    return NextResponse.json(result.data, { status: 200 });
  }
  // Format 5: Array response from n8n (take first item)
  else if (Array.isArray(result?.data) && result.data.length > 0) {
    const first = result.data[0];
    if (first?.content?.parts?.[0]?.text) {
      rawText = first.content.parts[0].text;
    } else if (typeof first?.text === 'string') {
      rawText = first.text;
    } else if (typeof first?.output === 'string') {
      rawText = first.output;
    } else if (first?.feedback || first?.rating) {
      return NextResponse.json(first, { status: 200 });
    }
  }
  // Format 6: Entire response is a string
  else if (typeof result?.data === 'string') {
    rawText = result.data;
  }

  if (!rawText) {
    console.error("❌ Could not extract text from webhook response. Full response:", JSON.stringify(result.data));
    return NextResponse.json(
      { error: "No response text from webhook", rawResponse: result.data },
      { status: 400 }
    );
  }

  // Strip markdown code fences (```json ... ```)
  const cleanJson = rawText
    .replace(/```(?:json)?\n?/gi, "")
    .replace(/\n?```/g, "")
    .trim();

  console.log("Cleaned JSON:", cleanJson.substring(0, 300));

  try {
    const parsed = JSON.parse(cleanJson);
    console.log("✅ Parsed feedback keys:", Object.keys(parsed));

    // Return ALL fields from the parsed feedback (not just a subset)
    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    console.error("Failed to parse feedback JSON:", error);
    console.error("Raw text was:", cleanJson.substring(0, 500));
    return NextResponse.json(
      { error: "Failed to parse feedback response", rawText: cleanJson },
      { status: 500 }
    );
  }
}
