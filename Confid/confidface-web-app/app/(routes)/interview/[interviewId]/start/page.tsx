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
const PRESENTER_ID = "amy-jcwCkr1grs"; // D-ID presenter/avatar ID

const DUMMY_CONVERSATION="[{'from':'bot','text':'Tell me about yourself.'},{'from':'user','text':'I am a React Developer working in IT for the last 7 years.'},{'from':'bot','text':'That\'s great to hear!'},{'from':'bot','text':'Can you explain the role of state in React and how it differs from props?'},{'from':'user','text':'I am working in the IT industry from last seven years.'},{'from':'bot','text':'Thank you for sharing that!'},{'from':'bot','text':'Can you explain the role of state in React and how it differs from props?'},{'from':'user','text':'State is used to manage the state of the React application like setting or getting values.'},{'from':'bot','text':'That\'s a good explanation!'},{'from':'bot','text':'How do you manage form state in a React application?'},{'from':'user','text':'Props are used to send values from one component to another.'},{'from':'bot','text':'Thank you for that clarification!'},{'from':'bot','text':'How do you manage form state in a React application?'},{'from':'user','text':'There are different libraries, but you can manage it using useState.'},{'from':'bot','text':'Great!'},{'from':'bot','text':'Thank you for your insights.'}]"

function startInterview() {
  const { interviewId } = useParams();
  const convex = useConvex();
  const [interviewData, setInterviewData] = useState<interviewData>();
  const videoContainerRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [sessionClientAnswer, setSessionClientAnswer] = useState<string | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Messages[]>([]);
  const iceCounterRef = useRef<number>(0);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const updateFeedback = useMutation(api.Interview.UpdateFeedback);
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  
  // Web Speech API utilities (FREE - no API keys needed)
  const { startListening } = useSpeechToText();
  const { speak } = useTextToSpeech();

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
    iceServers: RTCIceServer[]
  ) => {
    console.log("🚀 Initializing WebRTC with ICE servers:", iceServers.length);
    
    const pc = new RTCPeerConnection({ iceServers });
    peerConnection.current = pc;

    // D-ID requires explicit recvonly media sections
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

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
              videoElement.play().catch(err => console.warn("⚠️ Delayed video play error:", err));
              console.log("✅ Video attached after delay");
            } else {
              console.error("❌ Video element still not available after delay!");
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
      if (!pc.currentRemoteDescription) {
        console.warn("⚠️ currentRemoteDescription not set");
        return;
      }

      iceCounterRef.current++;
      const candidateNum = iceCounterRef.current;

      const candidate = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      };

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
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("📡 PC connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log("✅ WebRTC peer connection fully established");
      }
      if (pc.connectionState === "failed") {
        console.error("❌ WebRTC connection FAILED - check SDP or ICE");
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
    try {
      if (!interviewData?.interviewQuestions) {
        throw new Error("Interview data not loaded");
      }
      // Get initial script from server-side Gemini API
      console.log("Generating content with Gemini (server-side)...");
      const scriptResp = await axios.post("/api/generate-interview-script", {
        questions: interviewData.interviewQuestions,
        isInitial: true,
      });
      const initialScript: string = scriptResp.data?.text || "Hello! Let's begin.";
      console.log("Gemini response:", initialScript);

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
        
        // D-ID might return ICE servers or other connection info in response
        if (sdpResp.data?.ice_servers) {
          console.log("📡 Received ICE servers from D-ID SDP response");
        }
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

      // Wait for WebRTC connection to stabilize
      console.log("⏳ Waiting for WebRTC connection to stabilize...");
      let connectionAttempts = 0;
      while (connectionAttempts < 30 && peerConnection.current?.connectionState !== "connected") {
        if (peerConnection.current?.connectionState === "failed") {
          console.error("⚠️ Connection failed, retrying ICE candidates...");
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        connectionAttempts++;
      }
      
      if (peerConnection.current?.connectionState === "connected") {
        console.log("✅ WebRTC connection stabilized after", connectionAttempts * 100, "ms");
      } else {
        console.warn("⚠️ WebRTC connection not yet fully established, proceeding anyway. State:", peerConnection.current?.connectionState);
      }

      // Start audio capture for user responses
      console.log("Starting audio capture...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      console.log("🎤 Mic recording started");
      
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: initialScript },
      ]);

      // Play initial bot message using Web Speech API (FREE)
      console.log("🔊 Playing initial bot message...");
      speak(initialScript, () => {
        console.log("✅ Bot greeting played");
      });

      setMicOn(true);
      
      toast.success("Connected to interview!");
    } catch (error: any) {
      console.error("Failed to start conversation:", error);
      const rawMessage =
        error?.response?.data?.error ||
        error?.response?.data?.description ||
        error?.message ||
        "Failed to start conversation";
      const message = typeof rawMessage === "string" ? rawMessage : JSON.stringify(rawMessage);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const leaveConversation = async () => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    
    // Properly stop media recorder and stop all tracks
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        console.log("🎤 Audio blob created, size:", audioBlob.size);
        // Send to STT API when needed
      };
    }
    
    // Stop all mic tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      console.log("✅ Mic stream stopped");
    }

    if (streamId) {
      // Delete D-ID stream
      try {
        await axios.delete(`https://api.d-id.com/talks/streams/${streamId}`, {
          headers: {
            Authorization: `Basic ${process.env.NEXT_PUBLIC_D_ID_API_KEY}`,
          },
        });
      } catch (error) {
        console.error("Failed to delete stream:", error);
      }
    }

    setJoined(false);
    setMicOn(false);
    await GenerateFeedback();
  };

  const toggleMic = async () => {
    if (micOn) {
      // STOP recording and START speech recognition using Web Speech API (FREE)
      console.log("🎤 Starting speech recognition using Web Speech API...");
      setMicOn(false);
      
      // Use Web Speech API for STT (completely free!)
      startListening(
        async (transcript) => {
          // User's speech recognized successfully
          console.log("✅ User said:", transcript);
          
          if (!transcript.trim()) {
            toast.info("No speech detected. Please try again.");
            return;
          }
          
          // Add user message to conversation
          setMessages((prev) => [...prev, { from: "user", text: transcript }]);
          
          // Generate bot response with Gemini
          try {
            console.log("🤖 Generating bot response based on user's answer...");
            const geminiResponse = await axios.post("/api/generate-interview-script", {
              questions: interviewData?.interviewQuestions,
              conversationHistory: messages,
              userAnswer: transcript,
              isInitial: false,
            });
            const botResponse = geminiResponse.data?.text || "Thank you for your answer!";
            console.log("🤖 Bot response:", botResponse);
            
            // Add bot message to conversation
            setMessages((prev) => [...prev, { from: "bot", text: botResponse }]);
            
            // Play bot response using Web Speech API (completely free!)
            console.log("🔊 Speaking bot response...");
            speak(botResponse, () => {
              console.log("✅ Bot response spoken");
              setMicOn(true); // Enable mic again for next turn
            });
          } catch (err) {
            console.error("❌ Failed to generate bot response:", err);
            toast.error("Failed to generate response. Please try again.");
            setMicOn(true); // Re-enable mic
          }
        },
        (error) => {
          console.error("❌ Speech recognition error:", error);
          toast.error("Speech recognition error: " + error);
          setMicOn(true); // Re-enable mic
        }
      );
    } else {
      // START recording (ready to listen)
      setMicOn(true);
      console.log("🎤 Microphone ready to listen...");
      toast.info("Click Mute to stop speaking and process your response");
    }
  };

  useEffect(() => {
    console.log(JSON.stringify(messages));
  }, [messages]);

  const GenerateFeedback=async()=>{
    toast.info("Generating Feedback, Please wait...");

    const result = await axios.post('/api/interview-feedback',{
      messages: DUMMY_CONVERSATION,
    });
    console.log(result.data);
    toast.success("Feedback Generated Successfully!");
    //Save the feedback
    const resp=await updateFeedback({
      feedback:result.data,
      //@ts-ignore
      recordId:interviewId
    });
    console.log("Feedback saved:", resp);
    toast.success("Interview Completed Successfully!");
    //Navigate
    router.replace('/dashboard');
  }

  return (
    <div className="flex flex-col lg:flex-row w-full min-h-screen bg-gray-50">
      
      <div className="flex flex-col items-center py-4 px-6 lg:w-2/3">
        <h2 className="text-2xl font-bold mb-3">Interview Sessions</h2>
        <div
          id={CONTAINER_ID}
          className="rounded-2xl overflow-hidden border bg-white flex items-center justify-center"
          style={{
            width: 560,
            height: 420,
            marginTop: 10,
          }}
        >
          <video
            ref={videoContainerRef}
            autoPlay
            muted={false}
            playsInline
            className={`${joined ? "w-full h-full object-cover" : "hidden"}`}
          />
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
                    <Mic className="mr-2" size={20} /> Mute
                  </>
                ) : (
                  <>
                    <MicOff className="mr-2" size={20} /> Unmute
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