import { NextRequest, NextResponse } from "next/server";
import ImageKit from "imagekit";
import axios from "axios";
import { auth, currentUser } from "@clerk/nextjs/server";
import { aj } from "@/utils/arcjet";

//@ts-ignore
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_URL_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_URL_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

/**
 * Generate interview questions AND create D-ID streaming avatar that announces the questions
 * This combines question generation with avatar streaming in a single endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const jobTitle = formData.get("jobTitle") as string;
    const jobDescription = formData.get("jobDescription") as string;

    // Rate limiting check
    const { has } = await auth();
    const arcjetCtx = {
      getBody: async () => {
        try {
          return await req.text();
        } catch {
          return undefined;
        }
      },
    } as any;
    const decision = await aj.protect(arcjetCtx, {
      userId: user?.primaryEmailAddress?.emailAddress ?? "",
      requested: 5,
    });

    const isSubscribedUser = has({ plan: "pro" });
    //@ts-ignore
    if (decision?.reason?.remaining == 0 && !isSubscribedUser) {
      return NextResponse.json(
        {
          status: 429,
          result: "No free credit remaining, Try again after 24 hours",
        },
        { status: 429 }
      );
    }

    // Parse questions from raw text
    const parseQuestionsFromRawText = (raw: any): any[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw !== "string") return [];

      const original = raw;
      let t = raw
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();

      const firstArrayMatch = (() => {
        const start = t.indexOf("[");
        const end = t.lastIndexOf("]");
        if (start !== -1 && end !== -1 && end > start) {
          return t.slice(start, end + 1);
        }
        return null;
      })();

      const candidates = [] as string[];
      if (firstArrayMatch) candidates.push(firstArrayMatch);
      candidates.push(t);

      for (const candidate of candidates) {
        try {
          let parsed: any = JSON.parse(candidate);
          if (typeof parsed === "string") {
            const trimmed = parsed.trim();
            if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
              try {
                parsed = JSON.parse(parsed);
              } catch (e) {
                // leave as string if second parse fails
              }
            }
          }

          if (Array.isArray(parsed)) {
            const normalized = parsed.map((el: any) => {
              if (typeof el === "string") {
                const s = el.trim();
                if (s.startsWith("{") || s.startsWith("[")) {
                  try {
                    return JSON.parse(s);
                  } catch (e) {
                    // fall through
                  }
                }
                return { question: s, answer: null };
              }
              return el;
            });
            return normalized;
          }

          if (parsed && typeof parsed === "object") {
            const arr = parsed.questions ?? parsed.data ?? parsed.items ?? null;
            if (Array.isArray(arr)) return arr;
          }
        } catch (e) {
          // ignore and continue
        }
      }

      const lines = t
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const qa: any[] = [];
      let currentQ: string | null = null;
      for (const line of lines) {
        const qMatch = line.match(/^\s*(?:Q|Question)[:\-]\s*(.+)/i);
        const aMatch = line.match(/^\s*(?:A|Answer)[:\-]\s*(.+)/i);
        if (qMatch) {
          currentQ = qMatch[1].trim();
        } else if (aMatch) {
          const answer = aMatch[1].trim();
          qa.push({ question: currentQ, answer });
          currentQ = null;
        } else if (!currentQ) {
          qa.push({ question: line, answer: null });
        } else {
          currentQ = (currentQ + " " + line).trim();
        }
      }

      if (qa.length) return qa;
      return [{ question: original, answer: null }];
    };

    // Upload resume if provided
    let uploadUrl: string | null = null;
    if (file) {
      console.log("Uploading file...");
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const uploadResponse = await imagekit.upload({
        file: buffer,
        fileName: `upload-${Date.now()}.pdf`,
        isPrivateFile: false,
        useUniqueFileName: true,
      });
      uploadUrl = uploadResponse?.url ?? null;
    }

    // Call webhook to generate questions using Gemini
    const webhookUrl =
      process.env.WEBHOOK_URL ??
      "http://localhost:5678/webhook/generate-interview-question";
    console.log("Posting to webhook URL:", webhookUrl);

    const postBody = {
      resumeUrl: uploadUrl,
      jobTitle: jobTitle ?? null,
      jobDescription: jobDescription ?? null,
    };

    let result: any;
    try {
      result = await axios.post(webhookUrl, postBody, { maxRedirects: 0 });
    } catch (err: any) {
      const resp = err?.response;
      if (
        resp &&
        [301, 302, 303, 307, 308].includes(resp.status) &&
        resp.headers &&
        resp.headers.location
      ) {
        const redirected = resp.headers.location;
        console.log(
          `Webhook responded ${resp.status}, redirecting POST to: ${redirected}`
        );
        result = await axios.post(redirected, postBody);
      } else {
        throw err;
      }
    }

    console.log("webhook response status:", result?.status);
    const rawText =
      result?.data?.content?.parts?.[0]?.text ?? result?.data ?? null;
    console.log("extracted rawText:", rawText);

    if (result?.data?.status == 429) {
      return NextResponse.json(
        { error: result?.data?.result ?? "No free credit remaining" },
        { status: 429 }
      );
    }

    const parsedArr = parseQuestionsFromRawText(rawText);

    const extractQAArray = (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [];

      const hasInner = arr.every(
        (it) =>
          it &&
          (Array.isArray(it.interview_questions) || Array.isArray(it.questions))
      );
      if (hasInner) {
        return arr.flatMap(
          (it) => it.interview_questions ?? it.questions ?? []
        );
      }

      if (arr.length === 1) {
        const first = arr[0];
        if (first && Array.isArray(first.interview_questions))
          return first.interview_questions;
        if (first && Array.isArray(first.questions)) return first.questions;
        if (
          first &&
          Array.isArray(first.interview_questions ?? first.questions)
        )
          return first.interview_questions ?? first.questions;
      }

      return arr;
    };

    const qaArray = extractQAArray(parsedArr);
    const orderedQuestions = qaArray.map((q: any) => ({
      question: q?.question ?? q?.prompt ?? q?.q ?? q?.question_text ?? null,
      answer: q?.answer ?? q?.response ?? q?.a ?? q?.answer_text ?? null,
    }));

    console.log("Generated questions:", orderedQuestions.length);

    // Create D-ID streaming avatar with interview greeting script
    // Combine first few questions into a greeting script for the avatar
    const avatarScript = `Welcome to your interview preparation session! I'm here to help you prepare for your ${jobTitle || "upcoming"} position. 
    
    We'll be going through ${orderedQuestions.length} key interview questions that are commonly asked for this role. Let's make the most of this time to help you feel confident and prepared.
    
    Are you ready to begin?`;

    console.log("Creating D-ID avatar stream with script...");

    const didStreamResponse = await axios.post("/api/d-id-stream", {
      script: avatarScript,
    });

    console.log("✅ D-ID stream created:", didStreamResponse.data?.id);

    // Return both the questions and the avatar stream data
    return NextResponse.json(
      {
        success: true,
        questions: orderedQuestions,
        resumeUrl: uploadUrl,
        avatar: {
          streamId: didStreamResponse.data?.id,
          offer: didStreamResponse.data?.offer,
          ice_servers: didStreamResponse.data?.ice_servers,
          session_id: didStreamResponse.data?.session_id,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in generate-interview-questions-with-avatar:", error);
    const message =
      error?.response?.data?.error ||
      error?.message ||
      "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: error?.response?.status || 500 }
    );
  }
}
