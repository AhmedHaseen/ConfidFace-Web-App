import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { script } = await req.json();

  const apiKey = process.env.D_ID_API_KEY!;
  const encodedKey = Buffer.from(`${apiKey}:`).toString("base64");

  const didResponse = await axios.post(
    "https://api.d-id.com/talks/streams",
    {
      source_url:
        "https://ik.imagekit.io/4tljpfyal/premium_photo-1690407617542-2f210cf20d7e.jpg",
      script: {
        type: "text",
        input: script,
        provider: {
          type: "microsoft",
          voice_id: "en-US-JennyNeural",
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

  console.log("Full D-ID response body:", JSON.stringify(didResponse.data, null, 2));
  console.log("D-ID stream id:", didResponse.data?.id);
  console.log("D-ID session_id from body:", didResponse.data?.session_id);
  
  // D-ID returns the full Set-Cookie string in session_id field
  // We need to parse it and extract just the token values for the Cookie header
  const fullCookieString = didResponse.data?.session_id;
  
  let session_id = fullCookieString;
  
  // Parse out just the cookie name=value pairs (without attributes like Expires, Path, etc)
  if (fullCookieString) {
    const cookies: string[] = [];
    const parts = fullCookieString.split(';');
    
    for (const part of parts) {
      const trimmed = part.trim();
      // Keep only parts that have = (cookie name=value pairs)
      if (trimmed.includes('=') && !trimmed.startsWith('Expires') && !trimmed.startsWith('Path') && !trimmed.startsWith('SameSite') && !trimmed.startsWith('Secure')) {
        cookies.push(trimmed);
      }
    }
    
    session_id = cookies.join('; ');
    console.log("Parsed cookie for Cookie header:", session_id);
  }

  console.log("Using session_id:", session_id);

  // ✅ Return D-ID response with the actual session_id
  return NextResponse.json({
    ...didResponse.data,
    session_id,
  });
}