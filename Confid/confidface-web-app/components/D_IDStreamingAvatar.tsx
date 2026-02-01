"use client";
import React, { useEffect, useRef, useState } from "react";
import { Loader2Icon, XCircle } from "lucide-react";

interface D_IDStreamProps {
  streamId: string;
  offer: RTCSessionDescriptionInit;
  iceServers: RTCIceServer[];
  sessionId: string;
  onStreamReady?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * D-ID Streaming Avatar Component
 * Displays a live streaming avatar that speaks interview questions/greetings
 */
export const D_IDStreamingAvatar = ({
  streamId,
  offer,
  iceServers,
  sessionId,
  onStreamReady,
  onError,
  className = "w-full aspect-video bg-black rounded-lg",
}: D_IDStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iceCounterRef = useRef(0);

  useEffect(() => {
    const initializeWebRTC = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("🚀 Initializing WebRTC for D-ID avatar...");

        // Create peer connection
        const pc = new RTCPeerConnection({ iceServers });
        peerConnectionRef.current = pc;

        // D-ID requires explicit recvonly media sections
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        // Handle incoming tracks
        pc.ontrack = (event) => {
          console.log("📊 Track received:", event.track.kind);

          if (event.track.kind === "video" && videoRef.current) {
            const videoStream = new MediaStream([event.track]);
            videoRef.current.srcObject = videoStream;
            videoRef.current.muted = false;
            videoRef.current.autoplay = true;
            videoRef.current.playsInline = true;

            videoRef.current.play().catch((err) => {
              console.error("Video play error:", err);
            });
            console.log("✅ Video stream attached");
          }

          if (event.track.kind === "audio" && audioRef.current) {
            const audioStream = new MediaStream([event.track]);
            audioRef.current.srcObject = audioStream;
            audioRef.current.muted = false;
            audioRef.current.autoplay = true;

            audioRef.current.play().catch((err) => {
              console.error("Audio play error:", err);
            });
            console.log("✅ Audio stream attached");
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            iceCounterRef.current++;
            console.log(
              `📡 ICE candidate ${iceCounterRef.current}:`,
              event.candidate.candidate.substring(0, 50)
            );

            try {
              // Send ICE candidate to D-ID
              const response = await fetch("/api/d-id-stream-ice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  streamId,
                  sessionId,
                  candidate: event.candidate,
                }),
              });

              if (!response.ok) {
                throw new Error(
                  `ICE submission failed: ${response.statusText}`
                );
              }
              console.log(
                `✅ ICE candidate #${iceCounterRef.current} sent to D-ID`
              );
            } catch (err) {
              console.error("Failed to send ICE candidate:", err);
            }
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("🔗 Connection state:", pc.connectionState);
        };

        // Set remote offer
        console.log("Setting remote description...");
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Create and send answer
        console.log("Creating answer...");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send SDP answer back to D-ID
        console.log("Sending SDP answer to D-ID...");
        const sdpResponse = await fetch("/api/d-id-stream-sdp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamId,
            sessionId,
            answer: answer,
          }),
        });

        if (!sdpResponse.ok) {
          throw new Error(
            `SDP submission failed: ${sdpResponse.statusText}`
          );
        }

        console.log("✅ SDP answer sent successfully");
        setLoading(false);

        if (onStreamReady) {
          onStreamReady();
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "WebRTC initialization failed";
        console.error("❌ WebRTC error:", errorMsg);
        setError(errorMsg);
        setLoading(false);

        if (onError) {
          onError(errorMsg);
        }
      }
    };

    if (offer && streamId && sessionId) {
      initializeWebRTC();
    }

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [streamId, offer, iceServers, sessionId, onStreamReady, onError]);

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <Loader2Icon className="w-8 h-8 animate-spin text-white" />
            <p className="text-white text-sm">Initializing avatar...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <p className="text-white text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <video
        ref={videoRef}
        autoPlay
        muted={false}
        playsInline
        className="w-full h-full object-cover rounded-lg"
      />
      <audio ref={audioRef} autoPlay muted={false} />
    </div>
  );
};

export default D_IDStreamingAvatar;
