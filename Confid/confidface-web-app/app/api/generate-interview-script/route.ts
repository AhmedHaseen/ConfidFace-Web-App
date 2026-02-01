import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Optional sanity log. Remove in production if preferred.
console.log(process.env.GEMINI_API_KEY ? "[Gemini] KEY OK" : "[Gemini] KEY MISSING");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { questions = [], conversationHistory = [], userAnswer = "", isInitial = false } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }, { apiVersion: "v1" });

    let prompt = "";

    if (isInitial || !userAnswer) {
      // Initial greeting - ask first question
      prompt = `
You are a professional AI interview assistant.

Greet the candidate warmly and ask them the first interview question below.
Keep your response friendly and encouraging.
Your response should be 1-2 sentences max.

First Question to Ask:
${JSON.stringify(questions[0]?.question || "Tell me about yourself")}

Respond naturally as an interviewer would.`;
    } else {
      // Follow-up response based on user's answer
      prompt = `
You are a professional AI interview assistant conducting a technical interview.

The candidate just answered a question. Here's the context:

Current Question: ${questions[0]?.question || ""}
Candidate's Answer: ${userAnswer}

Interview Guidelines:
1. Provide brief, professional feedback on their answer (1 sentence)
2. Ask the next follow-up question based on their response
3. Be encouraging and constructive
4. Keep responses concise (2-3 sentences max)
5. If they gave a good answer, acknowledge it specifically

Generate a natural follow-up response that:
- References something they said
- Asks for clarification or deeper understanding
- Asks the next interview question`;
    }

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("[generate-interview-script] Error:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to generate interview script", details: err?.message },
      { status: 500 }
    );
  }
}
