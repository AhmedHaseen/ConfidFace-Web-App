/**
 * useWebSpeechSTT - Hook for Speech-to-Text using Web Speech API (FREE)
 * No API keys needed, works in all modern browsers
 */

export const useSpeechToText = () => {
  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const startListening = (
    onResult: (transcript: string) => void,
    onError: (error: string) => void
  ) => {
    if (!SpeechRecognition) {
      onError("Speech Recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("🎤 Listening...");
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      console.log("✅ Transcript:", transcript);
      onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("❌ Speech recognition error:", event.error);
      onError(`Recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      console.log("🎤 Listening ended");
    };

    recognition.start();

    return recognition;
  };

  return { startListening };
};

/**
 * useTextToSpeech - Hook for Text-to-Speech using Web Speech API (FREE)
 * No API keys needed, works in all modern browsers
 */

export const useTextToSpeech = () => {
  const speechSynthesis =
    typeof window !== "undefined" ? window.speechSynthesis : null;

  const speak = (text: string, onComplete?: () => void) => {
    if (!speechSynthesis) {
      console.error("Speech Synthesis not supported in this browser");
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Get available voices
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Try to find a female voice for bot
      const femaleVoice = voices.find(
        (voice) => voice.name.includes("Female") || voice.name.includes("female")
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      } else {
        utterance.voice = voices[0];
      }
    }

    utterance.onend = () => {
      console.log("✅ Speech synthesis complete");
      onComplete?.();
    };

    utterance.onerror = (event) => {
      console.error("❌ Speech synthesis error:", event.error);
    };

    speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (speechSynthesis) {
      speechSynthesis.cancel();
    }
  };

  return { speak, stop };
};
