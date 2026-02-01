import { NextRequest, NextResponse } from "next/server";
import ImageKit from "imagekit";
import axios from "axios";
import { resume } from "react-dom/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { aj } from "@/utils/arcjet";
import type { ArcjetAdapterContext } from "arcjet";

//@ts-ignore
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_URL_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_URL_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

export async function POST(req: NextRequest) {
  try {
    const user= await currentUser();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const jobTitle = formData.get("jobTitle") as string;
    const jobDescription = formData.get("jobDescription") as string;
    // Helper: robustly parse questions from the various text shapes the webhook
    // / model may return. We try several strategies in order:
    // 1. Strip markdown/code fences and extract a JSON array substring if present
    // 2. Try parsing the whole text as JSON (array or object containing an array)
    // 3. Fall back to simple Q/A line parsing
    // Adapt NextRequest to the Arcjet adapter shape required by aj.protect
    const {has}=await auth();

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
        }); // Deduct 5 tokens from the bucket
    console.log("Arcjet decision", decision);

    const isSubscribedUser=has({ plan: 'pro'})
    //@ts-ignore
    if(decision?.reason?.remaining==0 &&!isSubscribedUser)
      {
      return NextResponse.json
      ({ status:429,
        result:'No free credit remaining, Try again after 24 hours'
       }
      );
    }

    const parseQuestionsFromRawText = (raw: any): any[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw !== "string") return [];

      const original = raw;
      // Strip common code fences (```json ... ```) and surrounding markdown
      let t = raw
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();

      // If the model inserted a text prefix/suffix, try to extract the first JSON array
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
      candidates.push(t); // try whole text as a last resort

      for (const candidate of candidates) {
        try {
          let parsed: any = JSON.parse(candidate);
          // Handle double-encoded JSON where parsed is a string containing JSON
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

          // If the parsed value is an array, normalize each element:
          // - If element is a JSON string, try parsing it into an object
          // - If element is a plain string, treat it as a question text
          // - Otherwise return the element as-is (object)
          if (Array.isArray(parsed)) {
            const normalized = parsed.map((el: any) => {
              if (typeof el === "string") {
                const s = el.trim();
                if (s.startsWith("{") || s.startsWith("[")) {
                  try {
                    return JSON.parse(s);
                  } catch (e) {
                    // fall through to treat as plain string
                  }
                }
                return { question: s, answer: null };
              }
              return el;
            });
            return normalized;
          }

          // If the parsed value is an object that contains an array of questions,
          // try common keys
          if (parsed && typeof parsed === "object") {
            const arr = parsed.questions ?? parsed.data ?? parsed.items ?? null;
            if (Array.isArray(arr)) return arr;
          }
        } catch (e) {
          // ignore and continue to next candidate
        }
      }

      // If we couldn't JSON-parse, attempt a simple Q/A line-based extraction.
      // Look for lines starting with Q: / Question: and A: / Answer:
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
          // If no current question, treat the line as a standalone question string
          qa.push({ question: line, answer: null });
        } else {
          // Append to current question (multi-line question)
          currentQ = (currentQ + " " + line).trim();
        }
      }

      if (qa.length) return qa;

      // Last resort: return the original string as single question
      return [{ question: original, answer: null }];
    };

    // Perform upload (if file present) and call the webhook accordingly.
    let uploadUrl: string | null = null;
    if (file) {
      console.log("Uploading file, formData: ", formData);
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

    const webhookUrl = process.env.WEBHOOK_URL ?? "http://localhost:5678/webhook/generate-interview-question";
    console.log("Posting to webhook URL:", webhookUrl);

    const postBody = {
      resumeUrl: uploadUrl,
      jobTitle: jobTitle ?? null,
      jobDescription: jobDescription ?? null,
    };

    let result: any;
    try {
      // Attempt POST without following redirects so we can detect 3xx Location headers
      result = await axios.post(webhookUrl, postBody, { maxRedirects: 0 });
    } catch (err: any) {
      // If a redirect was issued (common for missing trailing slash or http->https), follow it with a POST
      const resp = err?.response;
      if (resp && [301, 302, 303, 307, 308].includes(resp.status) && resp.headers && resp.headers.location) {
        const redirected = resp.headers.location;
        console.log(`Webhook responded ${resp.status}, redirecting POST to: ${redirected}`);
        result = await axios.post(redirected, postBody);
      } else {
        throw err;
      }
    }

    console.log("webhook response status:", result?.status);
    console.log("webhook response headers:", result?.headers);
    console.log("webhook raw response:", result?.data);
    const rawText =
      result?.data?.content?.parts?.[0]?.text ?? result?.data ?? null;
    console.log("extracted rawText:", rawText);

    if (result?.data?.status == 429) {
      console.log(result?.data?.result);
      return NextResponse.json(
        { error: result?.data?.result ?? "No free credit remaining" },
        { status: 429 }
      );
    }

    const parsedArr = parseQuestionsFromRawText(rawText);
    console.log("parsedArr:", parsedArr);

    // Normalize cases where the model returns a top-level object containing
    // metadata plus an array under keys like `interview_questions` or `questions`.
    const extractQAArray = (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [];

      // If every element in the array is an object that contains an inner QA array,
      // flatten them into a single array of QA objects.
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

      // If single object with inner array, return that inner array.
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

      // Otherwise assume arr itself is the QA array.
      return arr;
    };

    const qaArray = extractQAArray(parsedArr);
    console.log("normalized QA array:", qaArray);

    const orderedQuestions = qaArray.map((q: any) => ({
      question: q?.question ?? q?.prompt ?? q?.q ?? q?.question_text ?? null,
      answer: q?.answer ?? q?.response ?? q?.a ?? q?.answer_text ?? null,
    }));

    return NextResponse.json(
      { questions: orderedQuestions, resumeUrl: uploadUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
