'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { chat } from '@/ai/flows/chat-flow';
import { textToSpeech } from '@/ai/flows/tts-flow';

export type AiStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

// Check for SpeechRecognition API
const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export const useVoiceAssistant = (onClose: () => void) => {
  const [status, setStatus] = useState<AiStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startListening = useCallback(() => {
    if (recognitionRef.current && status !== 'listening') {
      try {
        setTranscript('');
        setError('');
        setAudioDataUri(null);
        recognitionRef.current.start();
        setStatus('listening');
      } catch (e) {
        console.error("Could not start recognition", e);
      }
    }
  }, [status]);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser.');
      setStatus('error');
      return;
    }
    if (!recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                // Once we have a final transcript, stop listening and start thinking
                setTranscript(finalTranscript);
                recognition.stop();
                setStatus('thinking');
            } else {
                setTranscript(interimTranscript);
            }
        };
        
        recognition.onend = () => {
            // This can be triggered by .stop() or by silence.
            // If we are still in listening state, it means silence was detected before a final result.
            // If transcript is empty, it was just silence. If not, process it.
            setStatus(prev => {
                if (prev === 'listening') {
                    return 'thinking';
                }
                return prev;
            });
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'no-speech') {
                // This isn't a fatal error, just close the dialog.
                onClose();
            } else {
                setError(`Speech error: ${event.error}`);
                setStatus('error');
            }
        };

        recognitionRef.current = recognition;
    }
  }, [onClose]);

  // Process final transcript
  useEffect(() => {
    const processTranscript = async () => {
        if (status === 'thinking' && transcript) {
            try {
                const aiResponse = await chat({
                    message: transcript,
                    history: [], // For simplicity, voice chat is stateless for now
                });
                
                const audioUri = await textToSpeech(aiResponse);
                setAudioDataUri(audioUri);
                setStatus('speaking');

            } catch (err: any) {
                console.error("Error with AI interaction", err);
                setError(err.message || "An unknown error occurred.");
                setStatus('error');
            }
        } else if (status === 'thinking' && !transcript) {
            // Got to thinking state without a transcript (e.g. silence timeout)
            onClose();
        }
    };
    processTranscript();
  }, [status, transcript, onClose]);


  // Effect to start listening automatically
  useEffect(() => {
    // Wait a bit for the dialog to open, then start listening
    wakeTimeoutRef.current = setTimeout(() => {
      startListening();
    }, 1000);

    return () => {
        if (wakeTimeoutRef.current) {
            clearTimeout(wakeTimeoutRef.current)
        }
        if (recognitionRef.current) {
            recognitionRef.current.abort(); // Use abort to prevent onend from firing
        }
    }
  }, [startListening]);

  // Handle closing when on error
  useEffect(() => {
    if (status === 'error') {
        const timer = setTimeout(() => onClose(), 5000); // Close after 5s on error
        return () => clearTimeout(timer);
    }
  }, [status, onClose]);
  

  return { status, transcript, error, audioDataUri };
};
