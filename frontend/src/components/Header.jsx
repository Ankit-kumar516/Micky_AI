import React from 'react';
import { Volume2, VolumeX, Languages } from 'lucide-react';

export default function Header({ 
  autoSend, 
  onToggleAutoSend,
  language,
  onToggleLanguage 
}) {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-logo-container">
          <img 
            src="/assets/mickey-logo.png" 
            alt="Micky Icon" 
            className="brand-logo-img"
          />
        </div>
        <div className="brand-info">
          <h1>Micky</h1>
          <p>Your cheerful AI buddy!</p>
        </div>
      </div>

      <div className="header-badges">
        {/* Language Toggle Button */}
        <button 
          type="button" 
          className="badge-lang-mode"
          onClick={onToggleLanguage}
          title="Language Mode: Auto detects Hindi and English automatically"
        >
          <Languages size={15} />
          <span>
            {language === 'auto' && '🌐 Auto (Hindi / English)'}
            {language === 'hi' && '🇮🇳 Hindi Only'}
            {language === 'en' && '🇺🇸 English Only'}
          </span>
        </button>

        {/* Auto Voice Toggle Button */}
        <button 
          type="button" 
          className={`badge-auto-mode ${autoSend ? 'active' : 'muted'}`}
          onClick={onToggleAutoSend}
          title={autoSend ? "Auto Voice is ON: Micky speaks responses aloud" : "Auto Voice is OFF: Silent mode (Micky will not speak)"}
        >
          {autoSend ? <Volume2 size={15} /> : <VolumeX size={15} />}
          <span>Auto Voice: {autoSend ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </header>
  );
}
