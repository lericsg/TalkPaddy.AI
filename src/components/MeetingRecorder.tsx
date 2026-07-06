/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, Square, Pause, Play, AlertCircle, Loader2, 
  Settings, AudioLines, CheckCircle, RefreshCw, X 
} from 'lucide-react';
import { Meeting } from '../types';

interface MeetingRecorderProps {
  onMeetingSaved: (meeting: Meeting) => void;
  onCancel: () => void;
}

export default function MeetingRecorder({ onMeetingSaved, onCancel }: MeetingRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Status stages: 'idle' | 'recording' | 'transcribing' | 'summarizing' | 'completed'
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing' | 'summarizing' | 'completed'>('idle');
  const [progressText, setProgressText] = useState('');

  // Live real-time transcription states
  const [realtimeTranscript, setRealtimeTranscript] = useState('');
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Web Audio Visualizer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // SpeechRecognition instance and status trackers for restart cycle
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);

  // Automatically scroll the live transcript viewport as new text streams in
  useEffect(() => {
    const scrollArea = document.getElementById('live-transcript-scroll-area');
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [realtimeTranscript]);

  // Load available microphone devices
  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechRecognitionSupported(!!SpeechRecognitionClass);

    navigator.mediaDevices.enumerateDevices()
      .then(deviceInfos => {
        const audioInputs = deviceInfos.filter(device => device.kind === 'audioinput');
        setDevices(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      })
      .catch(err => {
        console.error('Error enumerating audio devices:', err);
      });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingResources();
    };
  }, []);

  const stopRecordingResources = () => {
    isRecordingRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Failed to stop speech recognition during resource cleanup:', e);
      }
      recognitionRef.current = null;
    }
  };

  const startVisualizer = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = 120;
      
      const draw = () => {
        if (!isRecording) return;
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          // Adjust responsiveness based on pause state
          const amplitude = isPaused ? 5 : dataArray[i];
          const barHeight = (amplitude / 255) * canvas.height * 0.85;
          
          const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
          grad.addColorStop(0, '#eff6ff'); // blue-50
          grad.addColorStop(0.5, '#3b82f6'); // blue-500
          grad.addColorStop(1, '#1d4ed8'); // blue-700
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          // Draw smooth rounded bars
          ctx.roundRect(x, canvas.height / 2 - barHeight / 2, barWidth - 2, barHeight || 4, 2);
          ctx.fill();
          
          x += barWidth;
        }
      };
      
      draw();
    } catch (e) {
      console.warn('Audio visualizer failed to initialize:', e);
    }
  };

  const startRecording = async () => {
    chunksRef.current = [];
    setErrorMessage(null);
    setDuration(0);
    setRealtimeTranscript('');
    
    isRecordingRef.current = true;
    isPausedRef.current = false;

    const constraints: MediaStreamConstraints = {
      audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
    };

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access denied. Please grant microphone permissions in your browser to record.');
      } else {
        setErrorMessage('Failed to start recording. Please verify your selected microphone is connected.');
      }
      setStatus('idle');
      return;
    }

    // Try starting MediaRecorder for audio file generation
    try {
      // Determine recording format
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser decide standard default
          }
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const finalBlob = chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          : null;
        await handleRecordingFinish(finalBlob, duration);
      };

      recorder.start(1000); // chunk every 1 second
    } catch (recErr) {
      console.warn('MediaRecorder failed to initialize, continuing with live SpeechRecognition only:', recErr);
      mediaRecorderRef.current = null;
    }

    // Initialize and start SpeechRecognition for live transcription
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      try {
        const rec = new SpeechRecognitionClass();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        let accumulatedTranscript = '';

        rec.onresult = (event: any) => {
          let interimText = '';
          let finalText = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
              finalText += result[0].transcript + ' ';
            } else {
              interimText += result[0].transcript;
            }
          }

          if (finalText) {
            accumulatedTranscript += finalText;
          }
          
          const currentText = (accumulatedTranscript + interimText).trim();
          setRealtimeTranscript(currentText);
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
        };

        rec.onend = () => {
          // Restart if recording is active and not paused
          if (isRecordingRef.current && !isPausedRef.current) {
            try {
              rec.start();
            } catch (e) {
              console.error('Failed to restart SpeechRecognition:', e);
            }
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (speechErr) {
        console.error('SpeechRecognition start failed:', speechErr);
      }
    }

    setIsRecording(true);
    setIsPaused(false);
    setStatus('recording');
    
    startVisualizer(stream);

    timerRef.current = window.setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  const pauseRecording = () => {
    if (!isRecording) return;

    if (isPaused) {
      // Resuming
      isPausedRef.current = false;
      setIsPaused(false);
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
      
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn('Failed to resume SpeechRecognition:', e);
        }
      }

      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      // Pausing
      isPausedRef.current = true;
      setIsPaused(true);
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Failed to pause SpeechRecognition:', e);
        }
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      stopRecordingResources();
      setIsRecording(false);
    } else {
      const totalDuration = duration;
      stopRecordingResources();
      setIsRecording(false);
      handleRecordingFinish(null, totalDuration);
    }
  };

  const cancelRecording = () => {
    isRecordingRef.current = false;
    isPausedRef.current = false;
    stopRecordingResources();
    setIsRecording(false);
    setIsPaused(false);
    setStatus('idle');
    setDuration(0);
    chunksRef.current = [];
    setRealtimeTranscript('');
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleRecordingFinish = async (audioBlob: Blob | null, totalDuration: number) => {
    try {
      setStatus('transcribing');
      setProgressText('Uploading and transcribing speech to text using Gemini 3.5 Flash...');
      
      let finalTranscript = '';
      let usedRealtimeFallback = false;

      // Try uploading and transcribing audio file if present
      if (audioBlob && audioBlob.size > 0) {
        try {
          const base64Audio = await blobToBase64(audioBlob);
          
          const transcribeRes = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: base64Audio,
              mimeType: audioBlob.type
            })
          });

          if (!transcribeRes.ok) {
            const errData = await transcribeRes.json();
            throw new Error(errData.error || 'Audio transcription endpoint failed');
          }

          const { transcript } = await transcribeRes.json();
          finalTranscript = transcript || '';
        } catch (audioErr) {
          console.warn('Audio post-processing transcription failed. Fallback to live transcript.', audioErr);
          if (realtimeTranscript && realtimeTranscript.trim() !== '') {
            finalTranscript = realtimeTranscript;
            usedRealtimeFallback = true;
          } else {
            throw audioErr;
          }
        }
      } else {
        // No audio blob recorded, use real-time transcript
        if (realtimeTranscript && realtimeTranscript.trim() !== '') {
          finalTranscript = realtimeTranscript;
          usedRealtimeFallback = true;
        } else {
          throw new Error('No audio was recorded and no real-time transcript was captured. Please verify your microphone is connected and try again.');
        }
      }

      // If audio transcription succeeded but was empty, check live transcript
      if (!finalTranscript || finalTranscript.trim() === '') {
        if (realtimeTranscript && realtimeTranscript.trim() !== '') {
          finalTranscript = realtimeTranscript;
          usedRealtimeFallback = true;
        } else {
          throw new Error('No clear speech was detected in the recording. Please try speaking closer to the microphone.');
        }
      }

      // Step 2: Summarize and extract meeting notes
      setStatus('summarizing');
      setProgressText(usedRealtimeFallback 
        ? 'Analyzing live-captured transcript to generate structured notes, action items, and decisions...'
        : 'Analyzing transcript to generate structured notes, action items, and decisions...'
      );

      const summarizeRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: finalTranscript })
      });

      if (!summarizeRes.ok) {
        const errData = await summarizeRes.json();
        throw new Error(errData.error || 'AI meeting summarization failed');
      }

      const { notes } = await summarizeRes.json();

      // Step 3: Package complete meeting details
      setStatus('completed');
      
      const newMeeting: Meeting = {
        id: crypto.randomUUID(),
        title: notes.title || `Meeting - ${new Date().toLocaleDateString()}`,
        date: new Date().toISOString(),
        duration: totalDuration,
        audioBlob: audioBlob || undefined,
        transcript: finalTranscript,
        notes: notes,
        createdAt: Date.now()
      };

      onMeetingSaved(newMeeting);

    } catch (err: any) {
      console.error('Error post-processing recording:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during transcription processing.');
      setStatus('idle');
    }
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8 max-w-xl mx-auto transition-colors duration-200" id="recorder-container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase" id="recorder-title">
            Record New Meeting
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Capture audio dynamically for instant transcripts and summaries.
          </p>
        </div>
        
        {devices.length > 0 && !isRecording && (
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
            title="Microphone Settings"
            id="mic-settings-btn"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && !isRecording && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-slate-200 dark:border-slate-800 pb-4 mb-4"
            id="settings-panel"
          >
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Select Recording Microphone
            </label>
            <select 
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-transparent transition-colors duration-200"
              id="mic-select"
            >
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${devices.indexOf(device) + 1}`}
                </option>
              ))}
            </select>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded p-4 flex gap-3 text-red-800 dark:text-red-200 text-sm mb-6" id="error-banner">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <p className="font-bold">Recording Error</p>
            <p className="text-red-700/95 dark:text-red-300 mt-1 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Recording Stage Visualizers */}
      <div className="flex flex-col items-center justify-center py-6">
        
        {status === 'idle' && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startRecording}
            className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-md focus:outline-none transition-all duration-300 cursor-pointer"
            title="Start Recording"
            id="start-recording-btn"
          >
            <Mic className="w-10 h-10 animate-pulse text-white/95" />
          </motion.button>
        )}

        {status === 'recording' && (
          <div className="w-full flex flex-col items-center" id="recording-active-area">
            <div className="text-4xl font-mono tracking-wider text-slate-800 dark:text-slate-100 font-bold mb-4" id="timer-display">
              {formatTime(duration)}
            </div>
            
            {/* Visualizer Canvas */}
            <div className="w-full bg-[#FBFCFD] dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded p-2 mb-6">
              <canvas ref={canvasRef} className="w-full h-[120px] block" />
            </div>

            {/* Live Real-time Transcription Feed */}
            <div className="w-full bg-[#FBFCFD] dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded p-4 mb-6 transition-colors duration-200">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live Transcript Feed
                </span>
                {isSpeechRecognitionSupported ? (
                  <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">
                    LIVE MIC FEED
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/40">
                    GEMINI AI POST-PROCESS
                  </span>
                )}
              </div>
              <div className="h-[120px] overflow-y-auto text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans text-left pr-1 scroll-smooth" id="live-transcript-scroll-area">
                {realtimeTranscript ? (
                  <p className="whitespace-pre-wrap">{realtimeTranscript}</p>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic text-center py-8">
                    Listening... Start speaking to see live transcription.
                  </p>
                )}
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex items-center gap-4" id="recording-controls">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={pauseRecording}
                className="w-12 h-12 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                title={isPaused ? "Resume Recording" : "Pause Recording"}
                id="pause-resume-btn"
              >
                {isPaused ? <Play className="w-5 h-5 text-slate-900 dark:text-white fill-slate-900 dark:fill-white" /> : <Pause className="w-5 h-5 text-slate-700 dark:text-slate-300" />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={stopRecording}
                className="px-6 h-12 rounded bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-750 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                id="stop-recording-btn"
              >
                <Square className="w-4 h-4 text-white fill-white" />
                Stop & Transcribe
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={cancelRecording}
                className="w-12 h-12 rounded border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/60 transition-all cursor-pointer"
                title="Cancel Recording"
                id="cancel-recording-btn"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        )}

        {/* Loading and AI Processing State */}
        {(status === 'transcribing' || status === 'summarizing') && (
          <div className="w-full py-6 flex flex-col items-center justify-center text-center" id="processing-loader">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900 rounded-full animate-ping opacity-25"></div>
              <div className="relative w-16 h-16 rounded bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
                {status === 'transcribing' ? (
                  <AudioLines className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-pulse" />
                ) : (
                  <RefreshCw className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin" />
                )}
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
              {status === 'transcribing' ? 'Transcribing Audio' : 'Synthesizing Smart Notes'}
            </h3>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-2 leading-relaxed px-4">
              {progressText}
            </p>
          </div>
        )}

        {status === 'idle' && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-6 font-semibold uppercase tracking-wider font-mono" id="tap-to-record-prompt">
            Click the microphone to begin recording
          </p>
        )}
      </div>

      {status === 'idle' && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
            id="recorder-cancel-btn"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
