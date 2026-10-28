import React, { useState } from 'react';
import { Mic, Send, Square } from 'lucide-react';

export default function InputBox({ 
  onSend, 
  isListening, 
  onToggleMic, 
  disabled 
}) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="input-section">
      <form onSubmit={handleSubmit} className="input-box-container">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask Micky anything..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || isListening}
        />

        <div className="input-actions">
          {/* Mic Button */}
          <button
            type="button"
            className={`mic-btn ${isListening ? 'active' : ''}`}
            onClick={onToggleMic}
            disabled={disabled}
            title={isListening ? "Listening... Click to stop" : "Speak to Micky"}
          >
            {isListening ? <Square size={18} /> : <Mic size={20} />}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            className="send-btn"
            disabled={disabled || !text.trim()}
            title="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </form>

      <div className="footer-note">
        🎤 Voice answers automatically • Gemini AI powered • React JS
      </div>
    </div>
  );
}
