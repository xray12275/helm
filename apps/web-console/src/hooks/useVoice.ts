import { useState, useRef, useCallback, useEffect } from 'react'
// Web Speech API types (SpeechRecognition, SpeechRecognitionEvent, window.webkitSpeechRecognition)
// come from @types/dom-speech-recognition, loaded automatically from devDependencies.

export interface UseVoiceReturn {
  startListening(): void
  stopListening(): void
  speak(text: string): void
  transcript: string
  isListening: boolean
  isSpeaking: boolean
}

export const useVoice = (): UseVoiceReturn => {
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis)

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      setTranscript('')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript

        if (event.results[i].isFinal) {
          setTranscript((prev) => (prev ? prev + ' ' : '') + transcript)
        } else {
          interimTranscript += transcript
        }
      }

      if (interimTranscript) {
        setTranscript((prev) => {
          const parts = prev.split(' ')
          return parts.slice(0, -1).join(' ') + ' ' + interimTranscript
        })
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech Recognition error:', event.error)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('')
      recognitionRef.current.start()
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }, [isListening])

  const speak = useCallback((text: string) => {
    if (!synthRef.current) {
      console.warn('Speech Synthesis API not supported')
      return
    }

    // Cancel any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => {
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = (event) => {
      console.error('Speech Synthesis error:', event)
      setIsSpeaking(false)
    }

    synthRef.current.speak(utterance)
  }, [])

  return {
    startListening,
    stopListening,
    speak,
    transcript,
    isListening,
    isSpeaking,
  }
}
