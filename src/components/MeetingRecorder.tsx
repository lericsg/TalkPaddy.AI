/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, Square, Pause, Play, AlertCircle, Loader2, 
  Settings, AudioLines, CheckCircle, RefreshCw, X, Clock
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
  
  // Status stages: 'idle' | 'recording' | 'naming' | 'transcribing' | 'summarizing' | 'completed'
  const [status, setStatus] = useState<'idle' | 'recording' | 'naming' | 'transcribing' | 'summarizing' | 'completed'>('idle');
  const [progressText, setProgressText] = useState('');

  // Live real-time transcription states
  const [realtimeTranscript, setRealtimeTranscript] = useState('');
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false);

  // Pending recording states for naming before saving
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDuration, setPendingDuration] = useState<number>(0);
  const [customTitle, setCustomTitle] = useState<string>('');

  // Expected meeting duration settings
  const [expectedMinutes, setExpectedMinutes] = useState<number>(10);
  const [customExpectedInput, setCustomExpectedInput] = useState<string>('');

  // Retry states
  const [retryParams, setRetryParams] = useState<{
    audioBlob: Blob | null;
    duration: number;
    realtimeTranscript: string;
    customTitle?: string;
  } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

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

  // Refs to avoid stale closures inside async event callbacks
  const durationRef = useRef<number>(0);
  const realtimeTranscriptRef = useRef<string>('');

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

  // Cooldown countdown timer for rate limit reset
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    
    const interval = window.setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

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
      
      let phase = 0;
      const draw = () => {
        if (!isRecordingRef.current) return;
        animationFrameRef.current = requestAnimationFrame(draw);
        
        let amplitude = 0;
        if (analyser && !isPausedRef.current) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          // Scale average volume to a responsive wave amplitude
          amplitude = (average / 255) * canvas.height * 0.45;
        }
        
        // Baseline amplitude so the waves continue to flow beautifully when silent or paused
        const baseAmplitude = isPausedRef.current ? 2.5 : 8.5;
        const finalAmplitude = baseAmplitude + amplitude;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Speed up the flow rate if active, slow down when paused
        phase += isPausedRef.current ? 0.015 : 0.065;
        
        const drawWave = (
          offsetPhase: number, 
          color: string, 
          frequencyMultiplier: number, 
          amplitudeMultiplier: number, 
          strokeWidth: number
        ) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';
          
          for (let x = 0; x <= canvas.width; x += 3) {
            const angle = (x / canvas.width) * Math.PI * 2 * frequencyMultiplier + phase + offsetPhase;
            const y = (canvas.height / 2) + Math.sin(angle) * finalAmplitude * amplitudeMultiplier;
            
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        };

        // Draw 3 layers of high-fidelity, intersecting sinusoidal waves
        // Back wave: Translucent Indigo
        drawWave(0, 'rgba(99, 102, 241, 0.22)', 1.3, 0.55, 2);
        // Middle wave: Translucent Violet/Teal
        drawWave(Math.PI * 0.35, 'rgba(168, 85, 247, 0.32)', 1.7, 0.75, 1.5);
        // Front wave: Solid bright Indigo
        drawWave(Math.PI * 0.7, '#4f46e5', 0.9, 1.0, 3.2);
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
    durationRef.current = 0;
    setRealtimeTranscript('');
    realtimeTranscriptRef.current = '';
    
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

      recorder.onstop = () => {
        const finalBlob = chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          : null;
        setPendingBlob(finalBlob);
        setPendingDuration(durationRef.current);
        setStatus('naming');
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
          realtimeTranscriptRef.current = currentText;
        };

        rec.onerror = (event: any) => {
          if (event.error === 'no-speech' || event.error === 'aborted') {
            console.log('Speech recognition non-fatal status:', event.error);
            return;
          }
          console.warn('Speech recognition warning status:', event.error);
        };

        rec.onend = () => {
          // Restart if recording is active and not paused
          if (isRecordingRef.current && !isPausedRef.current) {
            setTimeout(() => {
              if (isRecordingRef.current && !isPausedRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  console.log('Speech recognition restart deferred:', e);
                }
              }
            }, 300);
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (speechErr) {
        console.warn('SpeechRecognition start failed:', speechErr);
      }
    }

    setIsRecording(true);
    setIsPaused(false);
    setStatus('recording');
    
    startVisualizer(stream);

    timerRef.current = window.setInterval(() => {
      setDuration(prev => {
        const next = prev + 1;
        durationRef.current = next;
        return next;
      });
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
        setDuration(prev => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
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
      const totalDuration = durationRef.current;
      stopRecordingResources();
      setIsRecording(false);
      setPendingBlob(null);
      setPendingDuration(totalDuration);
      setStatus('naming');
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
    durationRef.current = 0;
    chunksRef.current = [];
    setRealtimeTranscript('');
    realtimeTranscriptRef.current = '';
    setPendingBlob(null);
    setPendingDuration(0);
    setCustomTitle('');
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

  const handleRecordingFinish = async (audioBlob: Blob | null, totalDuration: number, providedTitle?: string) => {
    // Keep parameters in state to support retries if any backend error occurs
    setRetryParams({
      audioBlob,
      duration: totalDuration,
      realtimeTranscript: realtimeTranscriptRef.current,
      customTitle: providedTitle || customTitle
    });

    await executeProcessingAndSave(audioBlob, totalDuration, realtimeTranscriptRef.current, providedTitle || customTitle);
  };

  const executeProcessingAndSave = async (
    audioBlob: Blob | null, 
    totalDuration: number, 
    savedRealtimeTranscript: string,
    providedTitle?: string
  ) => {
    try {
      setErrorMessage(null);
      setStatus('transcribing');
      setProgressText('Uploading audio and generating full meeting intelligence with Gemini 3.5 Flash...');
      
      let base64Audio: string | null = null;
      let mimeType: string | null = null;

      if (audioBlob && audioBlob.size > 0) {
        try {
          base64Audio = await blobToBase64(audioBlob);
          mimeType = audioBlob.type;
        } catch (err) {
          console.error("Failed to read audio blob:", err);
        }
      }

      // Check if we have neither audio nor draft transcript
      if (!base64Audio && (!savedRealtimeTranscript || savedRealtimeTranscript.trim() === '')) {
        throw new Error('No audio was recorded and no real-time transcript was captured. Please verify your microphone is connected and try again.');
      }

      // If we only have draft transcript and no audio, update progress text
      if (!base64Audio) {
        setProgressText('Refining live-captured transcript and generating structured notes with Gemini...');
      }

      const processRes = await fetch('/api/process-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64Audio || undefined,
          mimeType: mimeType || undefined,
          realtimeTranscript: savedRealtimeTranscript || undefined,
          customTitle: providedTitle || undefined
        })
      });

      if (!processRes.ok) {
        const errData = await processRes.json();
        throw new Error(errData.error || 'AI meeting processing failed');
      }

      const { notes } = await processRes.json();

      // Step 3: Package complete meeting details
      setStatus('completed');
      
      const finalTitle = (providedTitle && providedTitle.trim() !== '')
        ? providedTitle.trim()
        : (notes.title || `Meeting - ${new Date().toLocaleDateString()}`);

      const newMeeting: Meeting = {
        id: crypto.randomUUID(),
        title: finalTitle,
        date: new Date().toISOString(),
        duration: totalDuration,
        audioBlob: audioBlob || undefined,
        transcript: notes.transcript || savedRealtimeTranscript || '',
        notes: {
          title: finalTitle,
          summary: notes.summary || '',
          keyPoints: notes.keyPoints || [],
          decisions: notes.decisions || [],
          actionItems: notes.actionItems || [],
          tags: notes.tags || []
        },
        createdAt: Date.now()
      };

      await onMeetingSaved(newMeeting);
      
      // Successfully saved! Clear the retry parameters and cooldowns
      setRetryParams(null);
      setCooldownSeconds(0);

    } catch (err: any) {
      console.error('Error post-processing recording:', err);
      const rawMessage = err.message || 'An unexpected connection or processing error occurred.';
      
      // Check if it is a quota or rate-limit error (Status 429 / RESOURCE_EXHAUSTED)
      const isQuotaError = 
        rawMessage.toLowerCase().includes('quota') || 
        rawMessage.toLowerCase().includes('rate-limit') || 
        rawMessage.toLowerCase().includes('429') || 
        rawMessage.toLowerCase().includes('resource_exhausted') ||
        rawMessage.toLowerCase().includes('exceeded your current quota');

      if (isQuotaError) {
        // Parse custom seconds to wait if returned by the API
        const secondsMatch = rawMessage.match(/Please retry in ([\d\.]+)s/i);
        let extractedSeconds = 60; // default to 60 seconds
        if (secondsMatch && secondsMatch[1]) {
          extractedSeconds = Math.ceil(parseFloat(secondsMatch[1]));
        }
        
        setCooldownSeconds(extractedSeconds);
        setErrorMessage(`You have temporarily exceeded the Gemini API's free-tier rate limits. Please wait ${extractedSeconds} seconds for your quota to reset. Your meeting data has been kept completely safe! Just click "Retry Processing & Save" once the timer runs out.`);
      } else {
        setErrorMessage(rawMessage);
      }
      
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
        <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-150/60 dark:border-rose-900/40 rounded-2xl p-6 flex flex-col gap-4 text-rose-800 dark:text-rose-200 text-sm mb-8 shadow-sm transition-colors duration-200 animate-fade-in" id="error-banner">
          <div className="flex gap-4">
            <AlertCircle className="w-5.5 h-5.5 flex-shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold flex items-center gap-2 text-slate-900 dark:text-white text-base">
                <span>{cooldownSeconds > 0 ? 'Quota Limit Reached' : 'Recording Error'}</span>
                {cooldownSeconds > 0 && (
                  <span className="px-2.5 py-0.5 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[9px] font-bold font-mono rounded-lg animate-pulse uppercase tracking-wider">
                    Cooldown: {cooldownSeconds}s
                  </span>
                )}
              </p>
              <p className="text-slate-600 dark:text-slate-350 mt-1.5 leading-relaxed text-xs">
                {cooldownSeconds > 0 
                  ? `You have temporarily reached the free-tier rate limits for the Gemini API. Please wait about ${cooldownSeconds} more seconds for the quota to reset. Your recorded audio remains fully intact and safe—you won't lose your meeting details!`
                  : errorMessage
                }
              </p>
            </div>
          </div>
          {retryParams && (
            <div className="flex justify-end gap-3 pt-4 border-t border-rose-100/40 dark:border-rose-900/30">
              <button
                onClick={async () => {
                  setIsRetrying(true);
                  await executeProcessingAndSave(retryParams.audioBlob, retryParams.duration, retryParams.realtimeTranscript, retryParams.customTitle);
                  setIsRetrying(false);
                }}
                disabled={isRetrying || cooldownSeconds > 0}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 font-bold rounded-xl text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed text-white select-none"
                id="retry-processing-btn"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : cooldownSeconds > 0 ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Retry in {cooldownSeconds}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Processing & Save
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recording Stage Visualizers */}
      <div className="flex flex-col items-center justify-center py-8">
        
        {status === 'idle' && (
          <div className="w-full flex flex-col items-center gap-6" id="idle-controls-wrapper">
            {/* Target Meeting Duration Configuration Picker */}
            <div className="w-full max-w-sm bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4.5 text-center shadow-sm" id="expected-duration-picker">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3.5 select-none font-mono">
                Set Target Meeting Length
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                {[5, 10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setExpectedMinutes(mins);
                      setCustomExpectedInput('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      expectedMinutes === mins && !customExpectedInput
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    id={`expected-mins-btn-${mins}`}
                  >
                    {mins}m
                  </button>
                ))}
                <div className="relative inline-flex items-center">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    placeholder="Custom"
                    value={customExpectedInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomExpectedInput(val);
                      const parsed = parseInt(val, 10);
                      if (parsed > 0) {
                        setExpectedMinutes(parsed);
                      }
                    }}
                    className={`w-20 px-2 py-1.5 rounded-lg text-xs text-center border focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold ${
                      customExpectedInput
                        ? 'bg-indigo-600 border-indigo-600 text-white placeholder-white/80'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 placeholder-slate-400'
                    }`}
                    id="expected-mins-custom-input"
                  />
                  {customExpectedInput && (
                    <span className="absolute right-2 text-[10px] text-white select-none">m</span>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Currently configured for: <strong className="font-bold text-indigo-600 dark:text-indigo-400">{expectedMinutes} minutes</strong>
              </p>
            </div>

            <div className="relative group mt-2" id="start-recording-container">
              {/* Pulsing visual halo backgrounds */}
              <div className="absolute -inset-4 bg-indigo-500/10 dark:bg-indigo-400/5 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-30 group-hover:opacity-45 transition-all duration-300" />
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startRecording}
                className="w-26 h-26 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 focus:outline-none transition-all duration-300 cursor-pointer relative z-10"
                title="Start Recording"
                id="start-recording-btn"
              >
                <Mic className="w-11 h-11 text-white/95" />
              </motion.button>
            </div>
          </div>
        )}

        {status === 'recording' && (
          <div className="w-full flex flex-col items-center animate-fade-in" id="recording-active-area">
            <div className="text-5xl font-mono tracking-widest text-slate-900 dark:text-white font-black mb-6 flex items-center gap-3" id="timer-display">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              {formatTime(duration)}
            </div>

            {/* Target Meeting Duration Progress Indicator */}
            <div className="w-full bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4.5 mb-6 shadow-sm flex flex-col gap-2.5 transition-colors duration-200" id="meeting-progress-wrapper">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 select-none font-mono text-[10px] uppercase tracking-widest">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Target Progress
                </span>
                <span className={`font-mono font-black text-xs ${duration > expectedMinutes * 60 ? 'text-amber-600 dark:text-amber-400 animate-pulse font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                  {duration > expectedMinutes * 60 ? (
                    `OVERTIME +${formatTime(duration - expectedMinutes * 60)}`
                  ) : (
                    `${Math.min(100, Math.round((duration / (expectedMinutes * 60)) * 100))}%`
                  )}
                </span>
              </div>
              
              <div className="w-full bg-slate-200/60 dark:bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner relative">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    duration > expectedMinutes * 60 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600' 
                      : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                  }`}
                  style={{ width: `${Math.min(100, (duration / (expectedMinutes * 60)) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium">
                <span>Elapsed: {formatTime(duration)}</span>
                <span>Target: {expectedMinutes}:00</span>
              </div>
            </div>
            
            {/* Visualizer Canvas */}
            <div className="w-full bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 mb-6 shadow-inner">
              <canvas ref={canvasRef} className="w-full h-[120px] block" />
            </div>

            {/* Live Real-time Transcription Feed */}
            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 mb-6 shadow-sm transition-colors duration-200">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 select-none">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  Live stream
                </span>
                {isSpeechRecognitionSupported ? (
                  <span className="text-[8px] font-mono text-indigo-600 dark:text-indigo-400 font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/40 tracking-wider">
                    RECOGNITION ACTIVE
                  </span>
                ) : (
                  <span className="text-[8px] font-mono text-amber-600 dark:text-amber-400 font-extrabold uppercase bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-100/50 dark:border-amber-900/40 tracking-wider">
                    AI SYNTHESIS ONLY
                  </span>
                )}
              </div>
              <div className="h-[120px] overflow-y-auto text-sm text-slate-600 dark:text-slate-350 leading-relaxed font-sans text-left pr-1 scroll-smooth" id="live-transcript-scroll-area">
                {realtimeTranscript ? (
                  <p className="whitespace-pre-wrap">{realtimeTranscript}</p>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic text-center py-10">
                    Listening... Speak now to transcribe live.
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
                className="w-13 h-13 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-sm"
                title={isPaused ? "Resume Recording" : "Pause Recording"}
                id="pause-resume-btn"
              >
                {isPaused ? <Play className="w-5 h-5 text-indigo-600 dark:text-indigo-400 fill-indigo-600 dark:fill-indigo-400" /> : <Pause className="w-5 h-5 text-slate-700 dark:text-slate-300" />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={stopRecording}
                className="px-8 h-13 rounded-2xl bg-red-600 hover:bg-red-750 text-white font-bold flex items-center justify-center gap-2.5 shadow-md shadow-red-500/15 transition-all cursor-pointer uppercase text-xs tracking-widest"
                id="stop-recording-btn"
              >
                <Square className="w-4 h-4 text-white fill-white" />
                Stop Recording
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={cancelRecording}
                className="w-13 h-13 rounded-2xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all cursor-pointer shadow-sm"
                title="Cancel Recording"
                id="cancel-recording-btn"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        )}

        {status === 'naming' && (
          <div className="w-full flex flex-col items-center animate-fade-in" id="naming-active-area">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
              <AudioLines className="w-6 h-6 animate-pulse" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight text-center mb-1.5" id="naming-header">
              Name Your Meeting
            </h3>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-sm mb-6 leading-relaxed">
              Give your meeting a descriptive title. If left blank, Gemini AI will automatically generate an optimized title for you based on the conversation context.
            </p>
            
            <div className="w-full mb-6">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Project Sync with Dev Team"
                className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm animate-fade-in"
                id="meeting-custom-title-input"
                autoFocus
              />
            </div>
            
            <div className="flex items-center gap-3 w-full justify-center">
              <button
                onClick={() => {
                  setPendingBlob(null);
                  setPendingDuration(0);
                  setCustomTitle('');
                  setStatus('idle');
                }}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-all cursor-pointer"
                id="naming-cancel-btn"
              >
                Discard
              </button>
              
              <button
                onClick={async () => {
                  await handleRecordingFinish(pendingBlob, pendingDuration);
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:shadow-indigo-500/10"
                id="naming-save-btn"
              >
                <CheckCircle className="w-4 h-4" />
                Process & Save
              </button>
            </div>
          </div>
        )}

        {/* Loading and AI Processing State */}
        {(status === 'transcribing' || status === 'summarizing') && (
          <div className="w-full py-8 flex flex-col items-center justify-center text-center animate-fade-in" id="processing-loader">
            <div className="relative mb-6">
              <div className="absolute -inset-4 bg-indigo-100 dark:bg-indigo-900/20 rounded-full animate-pulse opacity-35"></div>
              <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900 rounded-full animate-ping opacity-20"></div>
              <div className="relative w-18 h-18 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center">
                {status === 'transcribing' ? (
                  <AudioLines className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                ) : (
                  <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
                )}
              </div>
            </div>
            
            <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tight">
              {status === 'transcribing' ? 'Converting Speech' : 'Synthesizing Smart Notes'}
            </h3>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-3.5 leading-relaxed px-4">
              {progressText}
            </p>
          </div>
        )}

        {status === 'idle' && (
          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-8 font-extrabold uppercase tracking-widest font-mono select-none" id="tap-to-record-prompt">
            TAP MICROPHONE TO BEGIN RECORDING
          </p>
        )}
      </div>

      {status === 'idle' && (
        <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex justify-end">
          <button 
            onClick={onCancel}
            className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-all cursor-pointer"
            id="recorder-cancel-btn"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

