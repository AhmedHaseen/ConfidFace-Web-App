import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Optional sanity log. Remove in production if preferred.
console.log(
  process.env.GEMINI_API_KEY ? "[Gemini] KEY OK" : "[Gemini] KEY MISSING",
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      questions = [], // used for initial greeting (array of all questions)
      currentQuestion = "", // the question the user just answered
      userAnswer = "",
      nextQuestion = null, // the next stored question to ask (null if last)
      questionNumber = 0,
      totalQuestions = 0,
      isInitial = false,
    } = body;

    const model = genAI.getGenerativeModel(
      { model: "gemini-2.5-flash-lite" },
      { apiVersion: "v1" },
    );

    let prompt = "";

    if (isInitial || !userAnswer) {
      // Initial greeting only - the actual question will be appended client-side
      prompt = `
You are a professional AI interview assistant.

Generate ONLY a short warm greeting for the candidate (1 sentence max).
Examples: "Welcome! Great to have you here today." or "Hi there, thanks for joining this interview!"

Do NOT ask any questions. Only output the greeting.`;
    } else if (nextQuestion) {
      // Feedback only - the next question will be appended client-side
      prompt = `
You are a professional AI interview assistant.

The candidate just answered a question.

Question: ${currentQuestion}
Answer: ${userAnswer}

Give brief, encouraging feedback on their answer (1 sentence only).
Do NOT ask any questions. Only give feedback on the answer above.`;
    } else {
      // Last question - feedback + thank you, no questions
      prompt = `
You are a professional AI interview assistant.

The candidate just answered the final interview question.

Question: ${currentQuestion}
Answer: ${userAnswer}

Give brief encouraging feedback (1 sentence) and thank them for completing the interview.
Do NOT ask any new questions. Keep it to 2 sentences max.`;
    }

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("[generate-interview-script] Error:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to generate interview script", details: err?.message },
      { status: 500 },
    );
  }
}
