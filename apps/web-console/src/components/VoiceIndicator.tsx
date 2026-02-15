import React, { useEffect, useState } from 'react'
import { useVoice } from '../hooks/useVoice'

const VOICE_COMMANDS = [
  'move unit',
  'advance',
  'shoot',
  'charge',
  'fight',
  'next phase',
  'undo',
]

export const VoiceIndicator: React.FC = () => {
  const { startListening, stopListening, transcript, isListening, isSpeaking } = useVoice()
  const [isPTT, setIsPTT] = useState(false)
  const [parsedIntent, setParsedIntent] = useState('')

  // Parse transcript for intents
  useEffect(() => {
    const lower = transcript.toLowerCase()
    for (const command of VOICE_COMMANDS) {
      if (lower.includes(command)) {
        setParsedIntent(command)
        return
      }
    }
    setParsedIntent('')
  }, [transcript])

  const handleMouseDown = () => {
    setIsPTT(true)
    startListening()
  }

  const handleMouseUp = () => {
    setIsPTT(false)
    stopListening()
  }

  if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Voice button */}
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl transition-all ${
          isListening
            ? 'bg-red-600 scale-110 shadow-lg shadow-red-500/50 animate-pulse'
            : 'bg-gray-700 hover:bg-gray-600'
        }`}
        title="Hold to speak (PTT)"
      >
        {isListening ? '🎙️' : '🎤'}
      </button>

      {/* Transcript Display */}
      {(isListening || transcript) && (
        <div className="absolute bottom-24 right-0 bg-chaos-black border-2 border-imperial-gold rounded-lg p-3 w-72 shadow-lg">
          {isListening && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">Listening...</span>
            </div>
          )}

          {isSpeaking && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">Speaking...</span>
            </div>
          )}

          {transcript && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Transcript:</p>
              <p className="text-sm text-white bg-gray-900 p-2 rounded">
                "{transcript}"
              </p>
            </div>
          )}

          {parsedIntent && (
            <div className="bg-green-900/30 border border-green-700 rounded p-2">
              <p className="text-xs text-gray-400">Parsed Intent:</p>
              <p className="text-sm text-green-300 font-bold">{parsedIntent}</p>
            </div>
          )}

          {!isListening && !isSpeaking && transcript && (
            <button
              onClick={() => {
                startListening()
              }}
              className="mt-2 w-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-1 rounded"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Instructions */}
      {!isListening && !transcript && (
        <div className="absolute bottom-24 right-0 bg-chaos-black border border-gray-700 rounded p-2 w-64 text-xs text-gray-400">
          Hold the mic button to speak. Say commands like "move unit", "charge", or "next phase".
        </div>
      )}
    </div>
  )
}
