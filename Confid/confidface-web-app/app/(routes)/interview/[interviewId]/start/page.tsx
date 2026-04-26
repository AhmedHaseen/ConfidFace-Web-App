"use client";
import { api } from "@/convex/_generated/api";
import axios from "axios";
import { useConvex, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import React, { use, useEffect, useRef, useState } from "react";
import { div, video } from "motion/react-client";
import { Button } from "@/components/ui/button";
import { User, PhoneCall, PhoneOff, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useSpeechToText, useTextToSpeech } from "@/utils/webSpeechAPI";

export type interviewData = {
  jobTitle: string | null;
  jobDescription: string | null;
  interviewQuestions: interviewQuestions[];
  feedback?: any;
  userId: string | null;
  _id: string;
  resumeUrl: string | null;
  status: string | null;
};

type interviewQuestions = {
  question: string;
  answer: string;
};
type Messages = {
  from: "user" | "bot";
  text: String;
};

const CONTAINER_ID = "d-id-avatar-container";
const PRESENTER_ID = "amy-jcwCkr1grs"; // D-ID presenter/avatar ID;
const AVATAR_IMAGE_URL =
  "https://ik.imagekit.io/4tljpfyal/premium_photo-1690407617542-2f210cf20d7e.jpg";

// Pre-recorded avatar video — place your video file in /public/avatar-video.mp4
const AVATAR_VIDEO_URL = "/avatar-video.mp4";

function startInterview() {
  const { interviewId } = useParams();
  const convex = useConvex();
  const [interviewData, setInterviewData] = useState<interviewData>();
  const videoContainerRef = useRef<HTMLVideoElement>(null);
  const avatarVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [sessionClientAnswer, setSessionClientAnswer] = useState<string | null>(
    null,
  );
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Messages[]>([]);
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const iceCounterRef = useRef<number>(0);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sdpSentRef = useRef<boolean>(false);
  const iceCandidateBuffer = useRef<any[]>([]);
  const updateFeedback = useMutation(api.Interview.UpdateFeedback);
  const router = useRouter();
  const micStreamRef = useRef<MediaStream | null>(null);

  // Keep a ref that always holds the latest messages (avoids stale closure in callbacks)
  const messagesRef = useRef<Messages[]>([]);

  // Web Speech API utilities (FREE - no API keys needed)
  const { startListening } = useSpeechToText();
  const { speak: rawSpeak } = useTextToSpeech();
  const recognitionRef = useRef<any>(null);

  // Wrapper around speak that tracks speaking state + plays/pauses avatar video
  const speak = (text: string, onEnd?: () => void) => {
    setIsSpeaking(true);
    // Play the pre-recorded avatar video while bot speaks
    if (avatarVideoRef.current) {
      avatarVideoRef.current
        .play()
        .catch((err) => console.warn("⚠️ Avatar video play error:", err));
    }
    rawSpeak(text, () => {
      setIsSpeaking(false);
      // Pause the avatar video when bot stops speaking
      if (avatarVideoRef.current) {
        avatarVideoRef.current.pause();
      }
      onEnd?.();
    });
  };

  // Track which stored question we're currently on (0-based)
  const questionIndexRef = useRef<number>(0);

  // Core listen-and-respond function: starts speech recognition,
  // processes the answer with Gemini, speaks the bot reply, then moves to next stored question.
  const listenAndRespond = () => {
    const questions = interviewData?.interviewQuestions || [];
    const currentIdx = questionIndexRef.current;

    // If all questions have been answered, end the interview
    if (currentIdx >= questions.length) {
      console.log("✅ All questions answered! Ending interview.");
      const closingMsg =
        "Thank you for your answers! That concludes our interview. Let me generate your feedback now.";
      setMessages((prev) => [...prev, { from: "bot", text: closingMsg }]);
      speak(closingMsg, () => {
        leaveConversation();
      });
      return;
    }

    console.log(
      `🎤 Listening for answer to question ${currentIdx + 1}/${questions.length}...`,
    );
    setMicOn(true);
    toast.info(
      `Question ${currentIdx + 1}/${questions.length} — speak your answer now.`,
    );

    recognitionRef.current = startListening(
      async (transcript) => {
        recognitionRef.current = null;
        console.log("✅ User said:", transcript);
        setMicOn(false);

        if (!transcript.trim()) {
          toast.info("No speech detected. Listening again...");
          listenAndRespond();
          return;
        }

        setMessages((prev) => [...prev, { from: "user", text: transcript }]);

        // Move to next question
        questionIndexRef.current = currentIdx + 1;
        const nextIdx = questionIndexRef.current;

        try {
          console.log(`🤖 Generating feedback for Q${currentIdx + 1}...`);
          const geminiResponse = await axios.post(
            "/api/generate-interview-script",
            {
              currentQuestion: questions[currentIdx]?.question,
              userAnswer: transcript,
              nextQuestion:
                nextIdx < questions.length
                  ? questions[nextIdx]?.question
                  : null,
              questionNumber: currentIdx + 1,
              totalQuestions: questions.length,
              isInitial: false,
            },
          );
          // Gemini returns ONLY feedback (no question)
          const feedback =
            geminiResponse.data?.text || "Thank you for your answer!";

          // Append the EXACT next stored question from Convex directly
          let botResponse: string;
          if (nextIdx < questions.length) {
            const nextQ = questions[nextIdx]?.question;
            botResponse = `${feedback} ${nextQ}`;
          } else {
            botResponse = feedback;
          }
          console.log("🤖 Bot response (feedback + stored Q):", botResponse);

          setMessages((prev) => [...prev, { from: "bot", text: botResponse }]);

          // Speak bot response, then listen for next question's answer
          speak(botResponse, () => {
            console.log(
              `✅ Bot response spoken. Moving to question ${nextIdx + 1}...`,
            );
            listenAndRespond();
          });
        } catch (err) {
          console.error("❌ Failed to generate bot response:", err);
          // Even on error, move to next question
          const fallback =
            nextIdx < questions.length
              ? `Thank you. Next question: ${questions[nextIdx]?.question}`
              : "Thank you for your answer!";
          setMessages((prev) => [...prev, { from: "bot", text: fallback }]);
          speak(fallback, () => listenAndRespond());
        }
      },
      (error) => {
        recognitionRef.current = null;
        console.error("❌ Speech recognition error:", error);
        toast.error("Speech recognition failed. Listening again...");
        // Auto-retry listening for same question
        setTimeout(() => listenAndRespond(), 1000);
      },
    );
  };

  useEffect(() => {
    GetInterviewQuestions();
  }, [interviewId]);

  const GetInterviewQuestions = async () => {
    const result = await convex.query(api.Interview.GetInterviewQuestions, {
      //@ts-ignore
      interviewRecordId: interviewId,
    });
    console.log(result);
    setInterviewData(result);
  };

  // Knowledge base endpoint removed - no longer needed with new D-ID flow

  // Initialize WebRTC for D-ID streaming
  const initializeWebRTC = async (
    offer: RTCSessionDescriptionInit,
    iceServers: RTCIceServer[],
  ) => {
    console.log("🚀 Initializing WebRTC with ICE servers:", iceServers.length);
    console.log("📋 ICE servers:", JSON.stringify(iceServers));

    // Filter ICE servers to only use TCP-based TURN (works through any firewall)
    // Keep STUN as-is, but for TURN only use TCP/TLS variants
    const filteredIceServers = iceServers.map((server) => {
      if (!server.urls) return server;
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      const tcpUrls = urls.filter(
        (url) =>
          url.startsWith("stun:") ||
          url.includes("transport=tcp") ||
          url.startsWith("turns:"),
      );
      console.log("🔧 Filtered ICE URLs:", tcpUrls);
      return { ...server, urls: tcpUrls.length > 0 ? tcpUrls : urls };
    });

    // Force relay to ensure we go through TURN (bypasses any firewall/NAT)
    const pc = new RTCPeerConnection({
      iceServers: filteredIceServers,
      iceTransportPolicy: "relay",
    });
    peerConnection.current = pc;

    // Do NOT add transceivers manually — D-ID's offer already contains
    // audio/video/datachannel m-lines. setRemoteDescription will create
    // the matching recvonly transceivers automatically.

    pc.ontrack = (event) => {
      console.log("🎥 ontrack fired! Track kind:", event.track.kind);
      console.log("📊 Track:", {
        kind: event.track.kind,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
      });

      // Handle video track
      if (event.track.kind === "video") {
        console.log("📹 Video track received");

        // Get or create video element - it might not be rendered yet due to async state updates
        let videoElement = videoContainerRef.current;
        if (!videoElement) {
          console.warn("⚠️ Video ref not ready yet, waiting for DOM...");
          // Wait for DOM to update with the video element
          setTimeout(() => {
            videoElement = videoContainerRef.current;
            if (videoElement) {
              const videoStream = new MediaStream([event.track]);
              videoElement.srcObject = videoStream;
              videoElement.muted = false;
              videoElement.autoplay = true;
              videoElement.playsInline = true;
              videoElement
                .play()
                .catch((err) =>
                  console.warn("⚠️ Delayed video play error:", err),
                );
              console.log("✅ Video attached after delay");
            } else {
              console.error(
                "❌ Video element still not available after delay!",
              );
            }
          }, 100);
          return;
        }

        // Create new MediaStream with just video track
        const videoStream = new MediaStream([event.track]);
        videoElement.srcObject = videoStream;
        videoElement.muted = false;
        videoElement.autoplay = true;
        videoElement.playsInline = true;

        videoElement
          .play()
          .then(() => {
            console.log("✅ Video playing");
          })
          .catch((err) => {
            console.warn("⚠️ Video play error:", err);
          });
      }

      // Handle audio track
      if (event.track.kind === "audio") {
        console.log("🔊 Audio track received");
        if (!audioRef.current) {
          audioRef.current = document.createElement("audio");
          audioRef.current.autoplay = true;
          audioRef.current.controls = false;
          document.body.appendChild(audioRef.current);
          console.log("✅ Audio element created");
        }

        // Create new MediaStream with just audio tracks
        const audioStream = new MediaStream([event.track]);
        audioRef.current.srcObject = audioStream;
        console.log("✅ Audio playing");
      }
    };

    pc.onicecandidate = async (event) => {
      if (!event.candidate) {
        console.log("🏁 End of candidates");
        return;
      }
      if (!streamIdRef.current) {
        console.warn("⚠️ streamId not set yet");
        return;
      }

      // Log candidate type for debugging
      const candidateStr = event.candidate.candidate;
      console.log("🧊 ICE candidate generated:", candidateStr.substring(0, 80));

      const candidate = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      };

      // Buffer ICE candidates until SDP answer has been sent to D-ID
      if (!sdpSentRef.current) {
        iceCandidateBuffer.current.push(candidate);
        console.log(
          `📦 ICE candidate buffered (SDP not yet sent). Buffer size: ${iceCandidateBuffer.current.length}`,
        );
        return;
      }

      iceCounterRef.current++;
      const candidateNum = iceCounterRef.current;

      try {
        await axios.post("/api/d-id-stream-ice", {
          streamId: streamIdRef.current,
          sessionId: sessionIdRef.current,
          candidate,
        });
        console.log(`✅ ICE candidate #${candidateNum} sent to D-ID`);
      } catch (err) {
        console.error(`❌ ICE candidate #${candidateNum} failed:`, err);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🔗 ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.error("❌ ICE connection failed - will not establish media");
        // Log ICE candidate pair stats for debugging
        pc.getStats().then((stats) => {
          stats.forEach((report) => {
            if (report.type === "candidate-pair") {
              console.log("📊 Candidate pair:", {
                state: report.state,
                local: report.localCandidateId,
                remote: report.remoteCandidateId,
                nominated: report.nominated,
              });
            }
            if (
              report.type === "local-candidate" ||
              report.type === "remote-candidate"
            ) {
              console.log(`📊 ${report.type}:`, {
                id: report.id,
                candidateType: report.candidateType,
                protocol: report.protocol,
                address: report.address,
                port: report.port,
              });
            }
          });
        });
      }
      if (pc.iceConnectionState === "checking") {
        console.log("🔄 ICE is checking candidates...");
      }
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        console.log("✅ ICE connection established!");
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("📦 ICE gathering state:", pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
      console.log("📡 PC connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log("✅ WebRTC peer connection fully established");
        setWebrtcConnected(true);
      }
      if (pc.connectionState === "failed") {
        console.error(
          "❌ WebRTC connection FAILED - falling back to avatar image + TTS",
        );
        setWebrtcConnected(false);
      }
    };

    pc.ondatachannel = (event) => {
      console.log("📨 Data channel received:", event.channel.label);
    };

    await pc.setRemoteDescription(offer);
    console.log("✅ Remote SDP offer set");

    const answer = await pc.createAnswer();
    console.log("✅ Answer created:", {
      type: answer.type,
      sdpLength: answer.sdp?.length,
      sdpPreview: answer.sdp?.substring(0, 100),
    });

    await pc.setLocalDescription(answer);
    console.log("✅ Local answer set");

    return answer;
  };

  const StartConversation = async () => {
    setLoading(true);
    // Reset refs for fresh connection
    sdpSentRef.current = false;
    iceCandidateBuffer.current = [];
    iceCounterRef.current = 0;
    questionIndexRef.current = 0;
    try {
      if (!interviewData?.interviewQuestions) {
        throw new Error("Interview data not loaded");
      }
      // Get initial greeting from Gemini (greeting only, no question)
      console.log("Generating greeting with Gemini (server-side)...");
      const scriptResp = await axios.post("/api/generate-interview-script", {
        questions: interviewData.interviewQuestions,
        isInitial: true,
      });
      const greeting: string =
        scriptResp.data?.text || "Welcome! Great to have you here today.";

      // Append the EXACT first question from Convex directly
      const firstQuestion =
        interviewData.interviewQuestions[0]?.question ||
        "Tell me about yourself.";
      const initialScript = `${greeting} ${firstQuestion}`;
      console.log("Initial script (greeting + stored Q1):", initialScript);

      // Create D-ID streaming session
      console.log("Creating D-ID session...");
      const sessionResponse = await axios.post("/api/d-id-session", {
        script: initialScript,
      });

      console.log("D-ID Session Response:", sessionResponse.data);

      const { id, offer, ice_servers, session_id } = sessionResponse.data;
      if (!id || !offer) {
        throw new Error("D-ID stream creation failed");
      }

      console.log("Session created:", {
        id,
        session_id,
      });

      console.log("D-ID session_id:", session_id);

      // Set refs BEFORE initializing WebRTC so ICE candidates can be sent
      streamIdRef.current = id;
      sessionIdRef.current = session_id;

      // Also set state for UI
      setStreamId(id);
      setSessionId(session_id);
      setIceServers(ice_servers || []);

      // Initialize WebRTC connection
      console.log("Initializing WebRTC...");
      const answer = await initializeWebRTC(offer, ice_servers || []);

      // Send answer back to D-ID
      console.log("Sending answer to D-ID...");

      console.log("Before SDP send:", {
        streamId: id,
        sessionId: session_id,
        hasSdp: !!answer?.sdp,
      });

      const sdpPayload = {
        streamId: id,
        sessionId: session_id, // EXACT value from D-ID
        answer: answer, // Already has type and sdp from pc.createAnswer()
      };
      console.log("Sending SDP:", {
        streamId: sdpPayload.streamId,
        sessionIdLength: sdpPayload.sessionId?.length,
        sdpLength: sdpPayload.answer.sdp?.length,
        hasAnswer: !!sdpPayload.answer?.sdp,
      });

      try {
        const sdpResp = await axios.post("/api/d-id-stream-sdp", sdpPayload);
        console.log("✅ SDP answer sent successfully:", {
          status: sdpResp.status,
          hasSessionId: !!sdpResp.data?.session_id,
        });

        // Mark SDP as sent and flush buffered ICE candidates
        sdpSentRef.current = true;
        console.log(
          `📤 Flushing ${iceCandidateBuffer.current.length} buffered ICE candidates...`,
        );
        for (const bufferedCandidate of iceCandidateBuffer.current) {
          iceCounterRef.current++;
          try {
            await axios.post("/api/d-id-stream-ice", {
              streamId: id,
              sessionId: session_id,
              candidate: bufferedCandidate,
            });
            console.log(
              `✅ Buffered ICE candidate #${iceCounterRef.current} sent`,
            );
          } catch (err) {
            console.error(
              `❌ Buffered ICE candidate #${iceCounterRef.current} failed:`,
              err,
            );
          }
        }
        iceCandidateBuffer.current = [];
      } catch (sdpError: any) {
        console.error("❌ SDP send failed:", {
          status: sdpError.response?.status,
          statusText: sdpError.response?.statusText,
          error: sdpError.response?.data?.error || sdpError.message,
        });
        throw sdpError;
      }

      // NOW set joined=true after SDP is confirmed
      setJoined(true);

      // Wait briefly for WebRTC (up to 5 seconds) - if it fails, avatar image fallback is shown
      console.log(
        "⏳ Waiting for WebRTC connection (avatar image shown as fallback)...",
      );
      let connectionAttempts = 0;
      const maxAttempts = 50; // 5 seconds
      while (
        connectionAttempts < maxAttempts &&
        peerConnection.current?.connectionState !== "connected"
      ) {
        if (peerConnection.current?.connectionState === "failed") {
          console.warn(
            "⚠️ WebRTC failed after",
            connectionAttempts * 100,
            "ms — using avatar image + TTS fallback",
          );
          toast.info(
            "Using avatar image mode (WebRTC unavailable on your network)",
          );
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        connectionAttempts++;
      }

      if (peerConnection.current?.connectionState === "connected") {
        console.log(
          "✅ WebRTC connection stabilized after",
          connectionAttempts * 100,
          "ms",
        );
      } else {
        console.warn(
          "⚠️ WebRTC connection not yet fully established, proceeding anyway. State:",
          peerConnection.current?.connectionState,
        );
      }

      // Request mic permission early so Web Speech API can use it
      console.log("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      // Stop the stream immediately — Web Speech API will handle mic access on its own
      // We just need the permission grant here
      stream.getTracks().forEach((track) => track.stop());
      console.log("✅ Mic permission granted");

      setMessages((prev) => [...prev, { from: "bot", text: initialScript }]);

      // Play initial bot message, then auto-start listening
      console.log("🔊 Playing initial bot message...");
      speak(initialScript, () => {
        console.log("✅ Bot greeting played, auto-listening...");
        listenAndRespond();
      });

      setJoined(true);

      toast.success("Connected to interview!");
    } catch (error: any) {
      console.error("Failed to start conversation:", error);
      const rawMessage =
        error?.response?.data?.error ||
        error?.response?.data?.description ||
        error?.message ||
        "Failed to start conversation";
      const message =
        typeof rawMessage === "string"
          ? rawMessage
          : JSON.stringify(rawMessage);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const leaveConversation = async () => {
    // Stop any active speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        /* ignore */
      }
      recognitionRef.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    // Stop all mic tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      console.log("✅ Mic stream stopped");
    }

    if (streamId) {
      // Clean up D-ID stream via server-side API (requires auth + session cookie)
      try {
        await axios.delete("/api/d-id-stream", {
          data: {
            streamId: streamId,
            sessionId: sessionIdRef.current,
          },
        });
        console.log("✅ D-ID stream deleted");
      } catch (error) {
        // Stream will expire automatically - non-critical error
        console.warn("D-ID stream cleanup failed (will auto-expire):", error);
      }
    }

    setJoined(false);
    setMicOn(false);
    await GenerateFeedback();
  };

  const toggleMic = async () => {
    if (micOn) {
      // User clicks "Mute" -> stop listening
      console.log("🎤 Muting - stopping speech recognition");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          /* ignore */
        }
        recognitionRef.current = null;
      }
      setMicOn(false);
      toast.info("Mic muted. Click Unmute to start listening again.");
    } else {
      // User clicks "Unmute" -> start listening again
      console.log("🎤 Unmuting - starting speech recognition");
      listenAndRespond();
    }
  };

  useEffect(() => {
    messagesRef.current = messages;
    console.log(JSON.stringify(messages));
  }, [messages]);

  const GenerateFeedback = async () => {
    toast.info("Generating Feedback, Please wait...");

    // Use messagesRef to get the LATEST conversation (not stale closure)
    const currentMessages = messagesRef.current;
    console.log(
      "📝 Sending conversation for feedback:",
      currentMessages.length,
      "messages",
    );

    const result = await axios.post("/api/interview-feedback", {
      messages: currentMessages,
    });
    console.log(result.data);
    toast.success("Feedback Generated Successfully!");
    //Save the feedback
    const resp = await updateFeedback({
      feedback: result.data,
      //@ts-ignore
      recordId: interviewId,
    });
    console.log("Feedback saved:", resp);
    toast.success("Interview Completed Successfully!");
    //Navigate
    router.replace("/dashboard");
  };

  return (
    <div className="flex flex-col lg:flex-row w-full min-h-screen bg-gray-50">
      <div className="flex flex-col items-center py-4 px-6 lg:w-2/3">
        <h2 className="text-2xl font-bold mb-3">Interview Sessions</h2>
        <div
          id={CONTAINER_ID}
          className="rounded-2xl overflow-hidden border bg-white flex items-center justify-center relative"
          style={{
            width: 560,
            height: 420,
            marginTop: 10,
          }}
        >
          {/* WebRTC video (shown only when connected) */}
          <video
            ref={videoContainerRef}
            autoPlay
            muted={false}
            playsInline
            className={`${joined && webrtcConnected ? "w-full h-full object-cover" : "hidden"}`}
          />

          {/* Pre-recorded avatar video (shown when joined but WebRTC not connected) */}
          {joined && !webrtcConnected && (
            <div className="relative w-full h-full">
              {/* Avatar video — plays when bot speaks, pauses when bot stops */}
              <video
                ref={avatarVideoRef}
                src={AVATAR_VIDEO_URL}
                muted
                loop
                playsInline
                poster={AVATAR_IMAGE_URL}
                className="w-full h-full object-cover"
              />
              {/* Speaking indicator overlay */}
              {isSpeaking && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 px-4 py-2 rounded-full">
                  <div className="w-1.5 h-4 bg-green-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                  <div className="w-1.5 h-6 bg-green-400 rounded-full animate-[pulse_0.6s_ease-in-out_0.15s_infinite]" />
                  <div className="w-1.5 h-3 bg-green-400 rounded-full animate-[pulse_0.6s_ease-in-out_0.3s_infinite]" />
                  <div className="w-1.5 h-5 bg-green-400 rounded-full animate-[pulse_0.6s_ease-in-out_0.45s_infinite]" />
                  <div className="w-1.5 h-3 bg-green-400 rounded-full animate-[pulse_0.6s_ease-in-out_0.1s_infinite]" />
                  <span className="text-white text-sm ml-2">Speaking...</span>
                </div>
              )}
              {/* Listening indicator overlay */}
              {micOn && !isSpeaking && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-blue-500/70 px-4 py-2 rounded-full">
                  <Mic size={16} className="text-white animate-pulse" />
                  <span className="text-white text-sm">Listening...</span>
                </div>
              )}
            </div>
          )}
          {!joined && (
            <div>
              <div>
                <User size={40} className="text-gray-500" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex space-x-4">
          {!joined ? (
            <button
              onClick={StartConversation}
              disabled={loading}
              className="flex items-center px-5 py-3 bg-green-500 text-white hover:bg-green-400 rounded-full shadow-lg transition disabled:opacity-50"
            >
              <PhoneCall className="mr-2" size={20} />
              {loading ? "Connecting..." : "Connect Call"}
            </button>
          ) : (
            <>
              {/* MIC BUTTON */}
              <button
                onClick={toggleMic}
                className={`flex items-center px-5 py-3 rounded-full shadow-lg transition 
                ${
                  micOn
                    ? "bg-yellow-400 hover:bg-yellow-300 text-white"
                    : "bg-gray-300 hover:bg-gray-200 text-gray-800"
                }`}
              >
                {micOn ? (
                  <>
                    <Mic className="mr-2" size={20} /> Listening...
                  </>
                ) : (
                  <>
                    <MicOff className="mr-2" size={20} /> Muted
                  </>
                )}
              </button>

              {/* LEAVE BUTTON */}
              <button
                onClick={leaveConversation}
                className="flex items-center px-5 py-3 bg-red-500 text-white hover:bg-red-400 rounded-full shadow-lg transition"
              >
                <PhoneOff className="mr-2" size={20} />
                Leave Call
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col p-6 lg:w-1/3 h-screen overflow-auto">
        <h2 className="text-lg font-semibold my-4">Conversations</h2>
        <div className="flex-1 border border-gray-200 rounded-xl p-4 space-y-3">
          {messages?.length == 0 ? (
            <div>
              <p>No Messages yet</p>
            </div>
          ) : (
            <div>
              {messages?.map((msg, index) => (
                <div key={index}>
                  <h2
                    className={`p-3 rounded-lg max-w-[80%] mt-1
                    ${
                      msg.from == "user"
                        ? "bg-blue-100 text-blue-700 self-start"
                        : "bg-green-100 text-green-700 self-end"
                    }
                    `}
                  >
                    {msg.text}
                  </h2>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default startInterview;
