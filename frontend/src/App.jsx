import React, { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import MickeyCenterCard from "./components/MickeyCenterCard";
import InputBox from "./components/InputBox";

// Backend API URL (FastAPI)
const API_URL = "http://localhost:8000/api/gemini-response";

export default function App() {
  const [status, setStatus] = useState("ready"); // 'ready' | 'listening' | 'thinking' | 'speaking'
  const [response, setResponse] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [language, setLanguage] = useState("auto"); // 'auto' (both Hindi & English) | 'hi' | 'en'
  const [voices, setVoices] = useState([]);
  const [silenceCountdown, setSilenceCountdown] = useState(null);

  const recognitionRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const latestResponseRef = useRef("");
  const autoSendRef = useRef(autoSend);
  const languageRef = useRef(language);
  const accumulatedTextRef = useRef("");
  const silenceTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const responseTimeoutRef = useRef(null);
  const isListeningRef = useRef(false);
  const isSendingRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const conversationSessionRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const speechContinuationRef = useRef(false);
  const detectedLanguageRef = useRef(null);
  const responseTimeoutSessionRef = useRef(null);
  const responseDeadlineRef = useRef(null);

  const detectMessageLanguage = (text) => {
    const words = text.toLowerCase().match(/[a-zA-Z]+/g) || [];
    const hindiWords = new Set([
      "aap",
      "apka",
      "aur",
      "batao",
      "chahiye",
      "hai",
      "hain",
      "haal",
      "ho",
      "kaise",
      "kahan",
      "kaun",
      "kya",
      "kuch",
      "mazedaar",
      "mera",
      "naam",
      "mujhe",
      "namaste",
      "nahi",
      "sunao",
      "tum",
      "yeh",
      "yaar",
    ]);
    const englishWords = new Set([
      "about",
      "are",
      "can",
      "do",
      "how",
      "is",
      "please",
      "tell",
      "what",
      "who",
      "why",
      "you",
    ]);
    const hindiScore = words.filter((word) => hindiWords.has(word)).length;
    const englishScore = words.filter((word) => englishWords.has(word)).length;
    const hasDevanagari = /[\u0900-\u097F]/.test(text);

    if (hasDevanagari) {
      return words.length > 0 ? "hinglish" : "hi";
    }
    if (hindiScore >= 2 && englishScore > 0) {
      return "hinglish";
    }
    if (hindiScore >= 2 || (hindiScore === 1 && englishScore === 0)) {
      return "hi";
    }
    if (englishScore > 0 || words.length > 0) {
      return "en";
    }

    return detectedLanguageRef.current || "en";
  };

  const getRecognitionLanguage = () =>
    languageRef.current === "hi" ? "hi-IN" : "en-IN";

  // Clear any active silence timers and countdown
  const clearSilenceTimers = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setSilenceCountdown(null);
  };

  const clearResponseTimeout = () => {
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    responseDeadlineRef.current = null;
  };

  const clearConversationTimers = () => {
    clearSilenceTimers();
    clearResponseTimeout();
    responseTimeoutSessionRef.current = null;
  };

  // Schedule a 2-second silence timer after user stops talking
  const scheduleSilenceTimer = () => {
    clearSilenceTimers();

    let countdown = 1; // 1 second shown before automatic send
    setSilenceCountdown(countdown);

    countdownIntervalRef.current = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setSilenceCountdown(null);
      } else {
        setSilenceCountdown(countdown);
      }
    }, 1000);

    silenceTimerRef.current = setTimeout(() => {
      const textToSend = accumulatedTextRef.current.trim();
      if (
        textToSend &&
        isListeningRef.current &&
        conversationActiveRef.current
      ) {
        isSendingRef.current = true;
        isListeningRef.current = false;
        setIsListening(false);
        clearSilenceTimers();

        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // ignore
          }
        }

        const messageLanguage = detectMessageLanguage(textToSend);
        detectedLanguageRef.current = messageLanguage;
        sendToGemini(
          textToSend,
          conversationSessionRef.current,
          messageLanguage,
        );
        accumulatedTextRef.current = "";
      }
    }, 2000);
  };

  const startResponseTimeout = (sessionId) => {
    if (
      responseDeadlineRef.current?.sessionId === sessionId &&
      responseTimeoutRef.current
    ) {
      return;
    }

    clearResponseTimeout();
    const deadline = Date.now() + 7000;
    responseDeadlineRef.current = { deadline, sessionId };
    responseTimeoutRef.current = setTimeout(
      () => {
        if (
          sessionId !== conversationSessionRef.current ||
          !conversationActiveRef.current ||
          !isListeningRef.current ||
          isSendingRef.current
        ) {
          return;
        }

        conversationSessionRef.current += 1;
        conversationActiveRef.current = false;
        isListeningRef.current = false;
        isSendingRef.current = false;
        accumulatedTextRef.current = "";
        clearConversationTimers();
        setIsListening(false);
        setIsSpeaking(false);
        setStatus("ready");

        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // ignore
          }
        }
      },
      Math.max(0, deadline - Date.now()),
    );
  };

  const startListeningForResponse = (sessionId) => {
    if (
      sessionId !== conversationSessionRef.current ||
      !conversationActiveRef.current ||
      isSendingRef.current
    ) {
      return;
    }

    clearSilenceTimers();
    accumulatedTextRef.current = "";
    isListeningRef.current = true;
    setIsListening(true);
    setStatus("listening");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = getRecognitionLanguage();
        responseTimeoutSessionRef.current = sessionId;
        recognitionRef.current.start();
      } catch (e) {
        responseTimeoutSessionRef.current = null;
        console.warn("Could not resume recognition:", e);
      }
    }
  };

  // Keep languageRef updated
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Preload and cache browser voices
  useEffect(() => {
    const loadVoices = () => {
      if ("speechSynthesis" in window) {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          setVoices(v);
        }
      }
    };

    loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Keep autoSendRef updated and stop speech if turned OFF
  useEffect(() => {
    autoSendRef.current = autoSend;
    if (!autoSend && isSpeaking) {
      handleStopSpeech();
    }
  }, [autoSend, isSpeaking]);

  // Keep latestResponseRef updated for replay
  useEffect(() => {
    latestResponseRef.current = response;
  }, [response]);

  // Setup Web Speech API for Speech-to-Text
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setStatus("listening");
        if (responseTimeoutSessionRef.current !== null) {
          const responseSessionId = responseTimeoutSessionRef.current;
          responseTimeoutSessionRef.current = null;
          startResponseTimeout(responseSessionId);
        }
      };

      recognition.onresult = (event) => {
        let finalStr = "";
        let interimStr = "";

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalStr += res[0].transcript + " ";
          } else {
            interimStr += res[0].transcript + " ";
          }
        }

        const fullText = (finalStr + interimStr).trim();
        if (fullText) {
          clearResponseTimeout();
          responseTimeoutSessionRef.current = null;
          accumulatedTextRef.current = fullText;
          scheduleSilenceTimer();
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error === "no-speech") {
          // Expected background silence, do not cancel listening mode
          return;
        }
        if (event.error === "not-allowed") {
          setIsListening(false);
          isListeningRef.current = false;
          clearConversationTimers();
          conversationActiveRef.current = false;
          conversationSessionRef.current += 1;
          setStatus("ready");
          return;
        }
        if (event.error !== "no-speech") {
          clearConversationTimers();
          conversationActiveRef.current = false;
          conversationSessionRef.current += 1;
          isListeningRef.current = false;
          setIsListening(false);
          setStatus("ready");
        }
      };

      recognition.onend = () => {
        // Keep mic persistently active while user is still in listening mode
        if (
          conversationActiveRef.current &&
          isListeningRef.current &&
          !isSendingRef.current &&
          !isSpeakingRef.current
        ) {
          try {
            recognition.lang = getRecognitionLanguage();
            recognition.start();
          } catch (e) {
            // Recognition already started or restarting
          }
        } else {
          if (!conversationActiveRef.current) {
            setIsListening(false);
            isListeningRef.current = false;
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn(
        "Web Speech Recognition API is not supported in this browser.",
      );
    }

    return () => {
      clearConversationTimers();
      conversationActiveRef.current = false;
      conversationSessionRef.current += 1;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Check if text is Hindi (Devanagari script)
  const isHindiText = (text) => {
    if (!text) return false;
    // All Gemini Hindi responses use Devanagari script (Unicode range 0900-097F)
    return /[\u0900-\u097F]/.test(text);
  };

  // Speak Gemini's response using Web Speech Synthesis with crystal-clear bilingual support
  const speakText = (
    text,
    continueConversation = false,
    sessionId = null,
    responseLanguage = null,
  ) => {
    if (!("speechSynthesis" in window)) {
      console.warn("Speech Synthesis is not supported in this browser.");
      return;
    }

    // Cancel any existing utterance
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const isHindi =
      responseLanguage === "hi" ||
      (responseLanguage === "hinglish" && isHindiText(text)) ||
      (responseLanguage === null && isHindiText(text));

    // Get current available voices
    const availableVoices =
      voices && voices.length > 0 ? voices : window.speechSynthesis.getVoices();

    if (isHindi) {
      // Set language to Hindi
      utterance.lang = "hi-IN";

      // Find dedicated Hindi voice
      const hindiVoice =
        availableVoices.find(
          (v) =>
            v.lang === "hi-IN" ||
            v.lang.startsWith("hi") ||
            v.name.toLowerCase().includes("hindi") ||
            v.name.includes("हिन्दी"),
        ) ||
        availableVoices.find(
          (v) => v.lang === "en-IN" || v.name.toLowerCase().includes("india"),
        );

      if (hindiVoice) {
        utterance.voice = hindiVoice;
      }

      // Natural, pleasant pitch and clear rate for flawless Hindi comprehension
      utterance.pitch = 1.05;
      utterance.rate = 0.95;
    } else {
      // Set language to English
      utterance.lang = "en-US";

      // Find cheerful English voice
      const englishVoice =
        availableVoices.find(
          (v) =>
            (v.lang.startsWith("en") &&
              (v.name.includes("Natural") ||
                v.name.includes("Google") ||
                v.name.includes("Samantha") ||
                v.name.includes("Karen") ||
                v.name.includes("US English"))) ||
            v.lang === "en-US",
        ) || availableVoices.find((v) => v.lang.startsWith("en"));

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.pitch = 1.25; // Playful Mickey pitch
      utterance.rate = 1.0;
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setStatus("speaking");
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      accumulatedTextRef.current = "";
      isSendingRef.current = false;

      if (
        speechContinuationRef.current &&
        continueConversation &&
        sessionId === conversationSessionRef.current
      ) {
        speechContinuationRef.current = false;
        startListeningForResponse(sessionId);
      } else {
        setStatus("ready");
      }
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis notice:", e);
      isSpeakingRef.current = false;
      speechContinuationRef.current = false;
      clearConversationTimers();
      conversationActiveRef.current = false;
      conversationSessionRef.current += 1;
      setIsSpeaking(false);
      setStatus("ready");
      isSendingRef.current = false;
    };

    currentUtteranceRef.current = utterance;
    speechContinuationRef.current = continueConversation;
    window.speechSynthesis.speak(utterance);
  };

  // Stop speaking
  const handleStopSpeech = () => {
    speechContinuationRef.current = false;
    clearConversationTimers();
    conversationActiveRef.current = false;
    conversationSessionRef.current += 1;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setStatus("ready");
    isSendingRef.current = false;
  };

  // Replay latest response
  const handleReplay = () => {
    if (latestResponseRef.current) {
      speakText(latestResponseRef.current);
    }
  };

  // Toggle Microphone
  const handleToggleMic = () => {
    if (!recognitionRef.current) {
      alert(
        "Speech Recognition is not supported in this browser. Please use Google Chrome or Edge.",
      );
      return;
    }

    // A mic click while Micky is speaking is an explicit manual stop.
    if (isSpeaking) {
      handleStopSpeech();
      clearConversationTimers();
      conversationActiveRef.current = false;
      conversationSessionRef.current += 1;
      isListeningRef.current = false;
      isSendingRef.current = false;
      accumulatedTextRef.current = "";
      setIsListening(false);
      setStatus("ready");
      return;
    }

    if (isListening) {
      // User tapped mic to stop early:
      clearConversationTimers();
      conversationActiveRef.current = false;
      conversationSessionRef.current += 1;
      isListeningRef.current = false;
      isSendingRef.current = false;
      setIsListening(false);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }

      accumulatedTextRef.current = "";
      setStatus("ready");
    } else {
      // Start listening continuously
      clearConversationTimers();
      conversationSessionRef.current += 1;
      conversationActiveRef.current = true;
      accumulatedTextRef.current = "";
      isSendingRef.current = false;
      isListeningRef.current = true;
      setIsListening(true);
      setStatus("listening");

      try {
        // In 'auto' or 'hi' mode, hi-IN handles Hindi & English seamlessly
        recognitionRef.current.lang = getRecognitionLanguage();
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Could not start recognition:", err);
      }
    }
  };

  // Send prompt to FastAPI Gemini Backend
  const sendToGemini = async (
    promptText,
    conversationSessionId = null,
    messageLanguage = null,
  ) => {
    if (!promptText) return;

    clearConversationTimers();
    accumulatedTextRef.current = "";
    isListeningRef.current = false;
    isSendingRef.current = true;
    setIsListening(false);

    // Stop microphone if listening
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }

    setStatus("thinking");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: promptText,
          language: messageLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const geminiReply =
        data.response || "Haha! That was fun! Ask me another one!";

      setResponse(geminiReply);

      // Only speak aloud automatically if autoSend is ON!
      if (autoSendRef.current) {
        speakText(
          geminiReply,
          conversationSessionId !== null &&
            conversationSessionId === conversationSessionRef.current &&
            conversationActiveRef.current,
          conversationSessionId,
          messageLanguage,
        );
      } else {
        setIsSpeaking(false);
        setStatus("ready");
      }
    } catch (error) {
      console.error("Error communicating with Gemini backend:", error);
      const errorMsg =
        "Oh boy! I couldn't reach my brain right now. Make sure the backend server is running!";
      setResponse(errorMsg);
      if (autoSendRef.current) {
        speakText(
          errorMsg,
          conversationSessionId !== null &&
            conversationSessionId === conversationSessionRef.current &&
            conversationActiveRef.current,
          conversationSessionId,
          messageLanguage,
        );
      } else {
        setIsSpeaking(false);
        setStatus("ready");
      }
    } finally {
      isSendingRef.current = false;
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        autoSend={autoSend}
        onToggleAutoSend={() => setAutoSend(!autoSend)}
        language={language}
        onToggleLanguage={() => {
          setLanguage((prev) => {
            if (prev === "auto") return "hi";
            if (prev === "hi") return "en";
            return "auto";
          });
        }}
      />

      {/* Main Mickey Card */}
      <main className="main-content">
        <MickeyCenterCard
          status={status}
          response={response}
          isSpeaking={isSpeaking}
          silenceCountdown={silenceCountdown}
          onReplay={handleReplay}
          onStopSpeech={handleStopSpeech}
        />
      </main>

      {/* Bottom Input Field with Mic & Send */}
      <InputBox
        onSend={(text) => {
          clearConversationTimers();
          const messageLanguage = detectMessageLanguage(text);
          detectedLanguageRef.current = messageLanguage;
          sendToGemini(text, null, messageLanguage);
        }}
        isListening={isListening}
        onToggleMic={handleToggleMic}
        disabled={status === "thinking"}
      />
    </div>
  );
}
