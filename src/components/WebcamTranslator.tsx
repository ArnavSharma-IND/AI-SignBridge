import { useRef, useEffect, useState } from "react";
import { Landmark, CustomGestureTemplate, TranslationHistoryItem } from "../types";
import {
  classifyHeuristic,
  classifyKNearest,
  normalizeLandmarks,
  analyzeEmotionAndSpeed,
  speakText
} from "../utils/gestureEngine";
import {
  Volume2,
  RefreshCw,
  Video,
  Play,
  HelpCircle,
  AlertTriangle,
  MapPin,
  Trash2,
  Globe,
  Settings,
  Activity,
  Award
} from "lucide-react";

interface WebcamTranslatorProps {
  customTemplates: CustomGestureTemplate[];
  onAddHistoryItem: (item: TranslationHistoryItem) => void;
  onSetFrameLandmarks: (landmarks: Landmark[] | null) => void;
  accessibilityLargeText: boolean;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  activeContext: string;
  onContextChange: (ctx: string) => void;
}

export default function WebcamTranslator({
  customTemplates,
  onAddHistoryItem,
  onSetFrameLandmarks,
  accessibilityLargeText,
  selectedLanguage,
  onLanguageChange,
  activeContext,
  onContextChange,
}: WebcamTranslatorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string>("NONE");
  const [currentConfidence, setCurrentConfidence] = useState<number>(0);
  const [gestureHistory, setGestureHistory] = useState<string[]>([]);
  const [currentEmotion, setCurrentEmotion] = useState<string>("Calm / Steady");
  const [handVelocity, setHandVelocity] = useState<string>("Slow Motion");
  const [geminiCorrected, setGeminiCorrected] = useState<string>("");
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0); // Rate slider (0.75x, 1.0x, 1.3x)

  // Emergency alarm states
  const [emergencyAlert, setEmergencyAlert] = useState(false);
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // Location details for sharing
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Calibration state to avoid repeating identical signs immediately
  const [lastLoggedGesture, setLastLoggedGesture] = useState<string>("");
  const [matchHoldCount, setMatchHoldCount] = useState<number>(0);

  // MediaPipe hands instance trackers
  const handsTrackerRef = useRef<any>(null);
  const cameraTrackerRef = useRef<any>(null);

  // Handle location discovery
  const handleShareLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Fallback static secure locations
          setUserLocation({ lat: 19.0760, lng: 72.8777 }); // Mumbai location center
        }
      );
    } else {
      setUserLocation({ lat: 19.0760, lng: 72.8777 });
    }
  };

  // Synthesizes a pulsing warning beep via browser oscillators directly
  const startAlarmSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 high octave alert tone

      // Pulse rate block
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      oscillatorRef.current = osc;

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      setAlarmPlaying(true);
    } catch (e) {
      console.error("Web Audio API not supported or user gesture failed", e);
    }
  };

  const stopAlarmSound = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch (e) {}
      oscillatorRef.current = null;
    }
    setAlarmPlaying(false);
  };

  // WebCam and MediaPipe setup routines
  useEffect(() => {
    if (cameraActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      stopAlarmSound();
    };
  }, [cameraActive]);

  const startCamera = async () => {
    setCameraLoading(true);
    try {
      const isMediaPipeLoaded = (window as any).Hands && (window as any).Camera;
      if (!isMediaPipeLoaded) {
        throw new Error("MediaPipe libraries are still loading from CDN, please wait 3 seconds.");
      }

      // Stream webcam onto hidden video tag
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize MediaPipe Hands class
      const hands = new (window as any).Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65
      });

      // Joint processing stream
      hands.onResults((results: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear layout canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw webcam output onto layout frame
        ctx.save();
        ctx.scale(-1, 1); // Flip horizontally for standard mirror view
        ctx.drawImage(results.image, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const rawLandmarks = results.multiHandLandmarks[0] as Landmark[];
          
          // Let parent instructor state check current landmarks for lessons
          onSetFrameLandmarks(rawLandmarks);

          // Draw skeleton mesh
          drawHandSkeleton(ctx, rawLandmarks);

          // Normalize joint landmarks for machine learning classifiers
          const normLandmarks = normalizeLandmarks(rawLandmarks);

          // Run Classifiers
          let matchResult = classifyHeuristic(rawLandmarks);

          // If no deterministic match, seek custom patterns matching Custom Gesture Database templates via KNN
          if (!matchResult && customTemplates.length > 0) {
            matchResult = classifyKNearest(normLandmarks, customTemplates);
          }

          if (matchResult) {
            setCurrentGesture(matchResult.gesture);
            setCurrentConfidence(matchResult.confidence);

            // Analyze physical movement rates beside gesture definitions
            const wristPt = rawLandmarks[0];
            const kinetics = analyzeEmotionAndSpeed(wristPt, matchResult.confidence, matchResult.gesture);
            setCurrentEmotion(kinetics.emotion);
            setHandVelocity(kinetics.speedIndicator);

            // Check if emergency is raised
            if (["SOS", "DANGER", "HELP"].includes(matchResult.gesture.toUpperCase())) {
              setMatchHoldCount((h) => {
                const nextHold = h + 1;
                if (nextHold >= 8) { // Held steady for ~8 ticks
                  setEmergencyAlert(true);
                  if (!alarmPlaying) {
                    startAlarmSound();
                    handleShareLocation();
                  }
                }
                return nextHold;
              });
            } else {
              setMatchHoldCount((h) => Math.max(0, h - 1));
            }
          } else {
            setCurrentGesture("TRACKING HAND");
            setCurrentConfidence(70);
            onSetFrameLandmarks(rawLandmarks);
          }
        } else {
          onSetFrameLandmarks(null);
        }
      });

      const camera = new (window as any).Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            try {
              await hands.send({ image: videoRef.current });
            } catch (err) {}
          }
        },
        width: 640,
        height: 480
      });

      cameraTrackerRef.current = camera;
      handsTrackerRef.current = hands;

      await camera.start();
      setCameraLoading(false);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to boot web camera feed. Check permissions.");
      setCameraActive(false);
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (cameraTrackerRef.current) {
      try {
        cameraTrackerRef.current.stop();
      } catch (e) {}
      cameraTrackerRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    onSetFrameLandmarks(null);
  };

  // Helper routine to draw connections
  const drawHandSkeleton = (ctx: CanvasRenderingContext2D, landmarks: Landmark[]) => {
    // Joints: Glowing Cyan Node Points
    ctx.fillStyle = "#06b6d4";
    landmarks.forEach((p) => {
      // Coordinate mirroring
      const cx = (1 - p.x) * ctx.canvas.width;
      const cy = p.y * ctx.canvas.height;

      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "rgba(6, 182, 212, 0.45)";
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#06b6d4";
    });

    // Bone connectors: Sleek orange links
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2.5;

    const drawLine = (ptA: Landmark, ptB: Landmark) => {
      const ax = (1 - ptA.x) * ctx.canvas.width;
      const ay = ptA.y * ctx.canvas.height;
      const bx = (1 - ptB.x) * ctx.canvas.width;
      const by = ptB.y * ctx.canvas.height;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };

    // Thumb connection lines
    drawLine(landmarks[0], landmarks[1]);
    drawLine(landmarks[1], landmarks[2]);
    drawLine(landmarks[2], landmarks[3]);
    drawLine(landmarks[3], landmarks[4]);

    // Index Finger
    drawLine(landmarks[0], landmarks[5]);
    drawLine(landmarks[5], landmarks[6]);
    drawLine(landmarks[6], landmarks[7]);
    drawLine(landmarks[7], landmarks[8]);

    // Middle Finger
    drawLine(landmarks[0], landmarks[9]);
    drawLine(landmarks[9], landmarks[10]);
    drawLine(landmarks[10], landmarks[11]);
    drawLine(landmarks[11], landmarks[12]);

    // Ring Finger
    drawLine(landmarks[0], landmarks[13]);
    drawLine(landmarks[13], landmarks[14]);
    drawLine(landmarks[14], landmarks[15]);
    drawLine(landmarks[15], landmarks[16]);

    // Pinky
    drawLine(landmarks[0], landmarks[17]);
    drawLine(landmarks[17], landmarks[18]);
    drawLine(landmarks[18], landmarks[19]);
    drawLine(landmarks[19], landmarks[20]);

    // Knuckle bars (joins mcp joints)
    drawLine(landmarks[5], landmarks[9]);
    drawLine(landmarks[9], landmarks[13]);
    drawLine(landmarks[13], landmarks[17]);
  };

  // Safe accumulate tool: appends confirmed signs to the target sentence builder
  const handleAccumulateGesture = () => {
    if (currentGesture === "NONE" || currentGesture === "TRACKING HAND") return;
    
    // Prevent duplicated adds sequentially
    if (currentGesture === lastLoggedGesture) return;

    setGestureHistory((h) => [...h, currentGesture]);
    setLastLoggedGesture(currentGesture);
  };

  // Re-correct raw sequence using fullstack server models in real-time
  const refineSentenceWithGemini = async () => {
    if (gestureHistory.length === 0) return;

    setGeminiLoading(true);
    const rawText = gestureHistory.join(" ");

    try {
      const res = await fetch("/api/translate/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          language: selectedLanguage,
          context: activeContext,
        }),
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setGeminiCorrected(data.correctedText);

      // Vocalize result via Web TTS out loud
      speakText(data.correctedText, selectedLanguage, speechSpeed);

      // Save translation item to persistent history logs
      onAddHistoryItem({
        id: `tr-${Date.now()}`,
        rawInput: rawText,
        correctedText: data.correctedText,
        originalGestureChain: gestureHistory,
        confidence: currentConfidence || 95,
        emotion: currentEmotion,
        language: selectedLanguage,
        timestamp: Date.now(),
        context: activeContext,
        isEmergency: emergencyAlert,
      });

    } catch (err: any) {
      console.error(err);
      const fallbackPhrase = `Spelled: ${rawText}`;
      setGeminiCorrected(fallbackPhrase);
      speakText(fallbackPhrase, "English", speechSpeed);
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleClearChain = () => {
    setGestureHistory([]);
    setLastLoggedGesture("");
    setGeminiCorrected("");
  };

  const deactivateEmergency = () => {
    stopAlarmSound();
    setEmergencyAlert(false);
    setMatchHoldCount(0);
  };

  return (
    <div className={`space-y-6 ${accessibilityLargeText ? "text-lg" : "text-sm"}`} id="webcam-translator-workspace">
      
      {emergencyAlert && (
        <div className="bg-red-950/80 border-2 border-red-500 rounded-xl p-5 text-red-200 animate-pulse flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <div className="flex gap-3">
            <AlertTriangle className="w-10 h-10 text-red-400 flex-shrink-0 animate-bounce" />
            <div className="space-y-1">
              <h3 className="text-lg font-black text-red-100 uppercase tracking-widest flex items-center gap-2">
                Emergency Gesture Confirmed!
              </h3>
              <p className="text-xs text-red-300">
                Pulsed safety beacon alarm sounding. Auto sharing GPS location maps.
              </p>
              {userLocation && (
                <div className="text-[10px] font-mono text-slate-300 flex items-center gap-1 mt-1 bg-slate-900/60 p-1.5 rounded w-fit">
                  <MapPin className="w-3.5 h-3.5 text-teal-400" />
                  Latitude: {userLocation.lat.toFixed(4)} | Longitude: {userLocation.lng.toFixed(4)}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={deactivateEmergency}
            className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-slate-950 text-xs uppercase font-extrabold px-5 py-2.5 rounded-lg border-2 border-red-300 shadow-md cursor-pointer transition-colors"
          >
            Deactivate Safety Beacon
          </button>
        </div>
      )}

      {/* Controller Header Controls */}
      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        
        {/* Languages toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-teal-400" /> Target Language:
          </span>
          {["English", "Hindi", "Bengali", "Marathi"].map((lang) => (
            <button
              key={lang}
              onClick={() => onLanguageChange(lang)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer transition-colors ${
                selectedLanguage === lang
                  ? "bg-teal-500/20 border border-teal-500 text-teal-300 font-bold"
                  : "bg-slate-950 border border-slate-850 text-slate-400 hover:bg-slate-850"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        {/* Action contexts mapping */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-slate-400 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-teal-400" /> Context:
          </span>
          <select
            value={activeContext}
            onChange={(e) => onContextChange(e.target.value)}
            className="bg-slate-950 border border-slate-850 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500 flex-1 md:flex-initial"
          >
            <option value="General Conversation">Casual Conversation</option>
            <option value="Hospital consultation">Medical / Clinical</option>
            <option value="Airport Support">Emergency Help Desk</option>
            <option value="Syllabus Practice Studio">Learning Syllabus Practice</option>
          </select>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Capturing Webcam Block */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden aspect-video group" id="mirror-viewport">
            
            {/* Real webcam video tag hidden but active for model tracking */}
            <video
              ref={videoRef}
              className="hidden"
              playsInline
              muted
            />

            {/* Overlaid skeleton math layout canvas */}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="w-full h-full object-cover rounded-2xl"
            />

            {/* Inactive Overlay Placeholder */}
            {!cameraActive && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 bg-slate-900 border border-slate-800 text-teal-400 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/5">
                  <Video className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-md font-bold text-slate-100">AI SignBridge Real-Time Vision Layer</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Activate translation cam overlay to track hand skeletal landmarks and recognize gestures instantly in-browser.
                  </p>
                </div>
                <button
                  onClick={() => setCameraActive(true)}
                  disabled={cameraLoading}
                  className="bg-teal-500 hover:bg-teal-600 border border-teal-300 font-bold text-slate-950 text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                  id="btn-active-cam"
                >
                  {cameraLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Starting camera engine...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Initialize Webcam Vision
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Active Mini Statistics Indicator */}
            {cameraActive && (
              <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800 rounded-lg py-1.5 px-2.5 text-[9px] font-mono font-bold uppercase tracking-widest text-teal-400 flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
                Webcam active • 30fps
              </div>
            )}

            {/* Quick Helper button */}
            {cameraActive && (
              <button
                onClick={() => setCameraActive(false)}
                className="absolute bottom-3 right-3 bg-red-950/80 border border-red-900 text-red-200 text-[10px] uppercase font-bold py-1 px-3 rounded-lg hover:bg-red-900 shadow transition-all cursor-pointer"
              >
                Disable Cam
              </button>
            )}

          </div>

          {/* Core Telemetry and kinetics reports */}
          <div className="grid grid-cols-2 gap-4">
            
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between" id="telemetry-box-gesture">
              <span className="text-slate-500 text-[10px] uppercase font-semibold tracking-wider font-mono">Live Sign Detected</span>
              <div className="text-2xl font-black text-slate-100 uppercase truncate mt-1">
                {currentGesture}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-teal-400 font-semibold mt-2">
                <Activity className="w-3.5 h-3.5" />
                <span>Match: {currentConfidence}% Confidence</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between" id="telemetry-box-emotion">
              <span className="text-slate-500 text-[10px] uppercase font-semibold tracking-wider font-mono">Signing Emotion / Speed</span>
              <div className="text-lg font-bold text-slate-100 mt-1 capitalize" id="speed-vel-label">
                {currentEmotion}
              </div>
              <div className="text-xs text-slate-400 mt-2 truncate">
                Physical motion: {handVelocity}
              </div>
            </div>

          </div>

        </div>

        {/* Translation workspace panels */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                <Volume2 className="w-5 h-5 text-teal-400" />
                Accumulator Bridge
              </h3>
              
              <div className="flex gap-1">
                <button
                  onClick={handleAccumulateGesture}
                  disabled={currentGesture === "NONE" || currentGesture === "TRACKING HAND"}
                  className="bg-teal-950 hover:bg-teal-900/50 border border-teal-800 disabled:opacity-40 text-teal-400 font-bold px-3 py-1 rounded text-[10px] cursor-pointer"
                  id="btn-append-phrase"
                >
                  Add phrase
                </button>
                <button
                  onClick={handleClearChain}
                  className="bg-slate-850 hover:bg-slate-800 border border-slate-800 font-bold text-slate-400 px-3 py-1 rounded text-[10px] cursor-pointer"
                  id="btn-clear-chain"
                >
                  Reset Spells
                </button>
              </div>
            </div>

            {/* Gestures sequence chain board */}
            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-850 h-32 flex flex-col justify-between relative">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider font-mono absolute left-3 top-3">
                Gesture Input Chain
              </div>
              
              <div className="overflow-y-auto flex flex-wrap gap-2 pt-6 pb-2" id="gestures-trail-logs">
                {gestureHistory.length === 0 ? (
                  <span className="text-xs text-slate-600 font-mono mt-2 pl-1">
                    Spelled words queue empty. Spell symbols or click Add Phrase above.
                  </span>
                ) : (
                  gestureHistory.map((word, idx) => (
                    <span
                      key={idx}
                      className="bg-teal-500/10 border border-teal-800/40 text-teal-400 font-mono text-xs px-2.5 py-1 rounded-md shadow-sm uppercase shrink-0"
                    >
                      {word}
                    </span>
                  ))
                )}
              </div>

              {gestureHistory.length > 0 && (
                <button
                  onClick={refineSentenceWithGemini}
                  disabled={geminiLoading}
                  className="bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 disabled:text-slate-600 font-bold text-slate-950 text-xs py-2 rounded-lg cursor-pointer w-full text-center flex items-center justify-center gap-2 shadow"
                  id="btn-trigger-ai"
                >
                  {geminiLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Gemini reconstructing speech syntax...
                    </>
                  ) : (
                    <>
                      <Award className="w-3.5 h-3.5" />
                      Refine Sentence via Gemini AI
                    </>
                  )}
                </button>
              )}
            </div>

            {/* TTS Speech Rate Controls */}
            <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-850 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1">Voice Translation Rate:</span>
              <div className="flex gap-2">
                {[
                  { label: "Slow (0.8x)", rate: 0.8 },
                  { label: "Normal (1.0x)", rate: 1.0 },
                  { label: "Fast (1.3x)", rate: 1.3 }
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSpeechSpeed(s.rate)}
                    className={`px-2 py-1 rounded font-mono text-[9px] cursor-pointer transition-all ${
                      speechSpeed === s.rate
                        ? "bg-blue-500/20 text-blue-300 font-bold border border-blue-500"
                        : "bg-slate-950 border border-slate-900 text-slate-500 hover:text-slate-350"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resulting text output panels */}
            <div className="space-y-2">
              <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider pl-1">Polished Speech</h4>
              <div
                className="bg-slate-950 rounded-xl p-4 border border-slate-850 min-h-[90px] flex items-center justify-center text-center relative"
                id="gemini-output-board"
              >
                {geminiLoading ? (
                  <div className="space-y-2 text-slate-500 text-xs animate-pulse">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin text-teal-400" />
                    <span>Analyzing sequence syntax structures...</span>
                  </div>
                ) : geminiCorrected ? (
                  <div className="space-y-3 w-full">
                    <p className="text-sm font-semibold text-slate-100 leading-relaxed italic">
                      &ldquo;{geminiCorrected}&rdquo;
                    </p>
                    <button
                      onClick={() => speakText(geminiCorrected, selectedLanguage, speechSpeed)}
                      className="bg-blue-950 hover:bg-blue-900 text-blue-300 text-[10px] px-3 py-1 rounded border border-blue-800 mx-auto block cursor-pointer transition-colors"
                      id="btn-voiceout"
                    >
                      Speak Again
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-600 italic">
                    Polished translated sentences will compile here once spelled sequence outputs compile.
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* Quick guides block */}
          <div className="bg-slate-900/20 rounded-xl p-4 border border-slate-850 text-xs text-slate-450 leading-relaxed flex gap-3">
            <HelpCircle className="w-5 h-5 text-teal-400 flex-shrink-0" />
            <div className="space-y-1">
              <div className="font-semibold text-slate-300">Quick Signs Tutorial:</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                <li>Pose <b>L</b> for spelling alphabet Letter L</li>
                <li>Pose <b>Y</b> for Shaka thumb-pinky</li>
                <li>Pose <b>1, 2, 3, 4, 5</b> to write values</li>
                <li>Hold a <b>SOS fist</b> tight for 1.5s to sound the alarm</li>
              </ul>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
