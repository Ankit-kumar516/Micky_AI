import React, { useEffect, useRef } from "react";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import mickyVideo from "../../../Micky_video.mp4";

export default function MickeyCenterCard({
  status,
  response,
  isSpeaking,
  onReplay,
  onStopSpeech,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isSpeaking) {
      video.currentTime = 0;
      video.play().catch(() => {
        // The browser may reject playback until the user has interacted.
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isSpeaking]);

  // Determine status pill text and style
  const getStatusBadge = () => {
    switch (status) {
      case "listening":
        return (
          <div className="status-pill listening">
            <span className="status-dot"></span>
            <span>Listening to you... 🎤</span>
          </div>
        );
      case "thinking":
        return (
          <div className="status-pill thinking">
            <span className="status-dot"></span>
            <span>Thinking... 💭</span>
          </div>
        );
      case "speaking":
        return (
          <div className="status-pill speaking">
            <div className="audio-equalizer">
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
            </div>
            <span>Micky is talking! 🔊</span>
          </div>
        );
      default:
        return (
          <div className="status-pill ready">
            <span className="status-dot"></span>
            <span>Ready to chat</span>
          </div>
        );
    }
  };

  return (
    <div
      className={`micky-card ${isSpeaking ? "speaking" : ""} ${status === "listening" ? "listening" : ""}`}
    >
      {/* Video Container with sound wave rings */}
      <div className="video-frame-container">
        {isSpeaking && (
          <div className="sound-rings">
            <div className="sound-ring"></div>
            <div className="sound-ring"></div>
            <div className="sound-ring"></div>
          </div>
        )}

        <div className="video-frame">
          <video
            ref={videoRef}
            src={mickyVideo}
            loop
            muted
            playsInline
            preload="metadata"
            className="micky-video"
          />
        </div>
      </div>

      {/* Greeting and description */}
      <h2 className="greeting-title">Hi! I'm Micky 👋</h2>
      <p className="greeting-desc">
        Ask me anything. Let's learn something fun!
      </p>

      {/* Status Pill Badge */}
      {getStatusBadge()}

      {/* Mickey's Response Bubble (User's input text is hidden as required) */}
      {response && (
        <div className="response-bubble-container">
          <div className="response-bubble">
            <div className="response-header">
              <span className="response-speaker">🐭 Micky says:</span>
              <div className="response-actions">
                {isSpeaking ? (
                  <button
                    type="button"
                    className="response-action-btn"
                    onClick={onStopSpeech}
                    title="Stop Micky speaking"
                  >
                    <VolumeX size={14} />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="response-action-btn"
                    onClick={onReplay}
                    title="Listen to Micky speak again"
                  >
                    <RotateCcw size={14} />
                    <span>Replay Voice</span>
                  </button>
                )}
              </div>
            </div>

            <p className="response-text">{response}</p>
          </div>
        </div>
      )}
    </div>
  );
}
