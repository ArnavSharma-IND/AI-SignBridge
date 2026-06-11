import { Landmark, CustomGestureTemplate } from "../types";

// Helper: Calculate 3D Euclidean distance between two points
export function getDistance(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
}

// Translate and scale landmarks so they are invariant to hand position and scale in camera
export function normalizeLandmarks(raw: Landmark[]): Landmark[] {
  if (raw.length < 21) return [];

  const wrist = raw[0];
  
  // 1. Translate wrist to (0,0,0)
  const translated = raw.map((pt) => ({
    x: pt.x - wrist.x,
    y: pt.y - wrist.y,
    z: pt.z - wrist.z,
  }));

  // 2. Define scale factor as wrist to middle finger MCP (landmark 9) distance
  const scale = getDistance(translated[9], { x: 0, y: 0, z: 0 }) || 1.0;

  // 3. Divide by scale
  return translated.map((pt) => ({
    x: pt.x / scale,
    y: pt.y / scale,
    z: pt.z / scale,
  }));
}

// Compare two normalized landmark arrays, returning a confidence matching score [0-100]
export function evaluateSimilarity(live: Landmark[], template: Landmark[]): number {
  if (live.length < 21 || template.length < 21) return 0;

  let totalDistance = 0;
  for (let i = 0; i < 21; i++) {
    // Give double weight to fingertips (4, 8, 12, 16, 20) where gesture information is densest
    const isFingertip = [4, 8, 12, 16, 20].includes(i);
    const weight = isFingertip ? 2.5 : 1.0;
    
    totalDistance += getDistance(live[i], template[i]) * weight;
  }

  // Normalized distance per point (weighted sum divided by sum of weights)
  // Total points: 16 normal points (weight 1) + 5 fingertip points (weight 2.5) = 28.5
  const normalizedDistance = totalDistance / 28.5;

  // An average distance of 0.25 represents an extremely poor match (0% confidence).
  // A distance of less than 0.05 is an almost perfect match (100% confidence).
  const maxAcceptableDistance = 0.30;
  const matchPercent = 100 * (1 - (normalizedDistance / maxAcceptableDistance));

  return Math.max(0, Math.min(100, Math.floor(matchPercent)));
}

// Classify gesture using heuristics (standard letters and numbers)
export function classifyHeuristic(landmarks: Landmark[]): { gesture: string; confidence: number } | null {
  if (landmarks.length < 21) return null;

  const wrist = landmarks[0];

  // Helper flags: Is a finger extended?
  // We measure if the finger tip is significantly further from the wrist than its primary pip/knuckle joint.
  const isExtended = (tip: number, joint: number) => {
    return getDistance(landmarks[tip], wrist) > getDistance(landmarks[joint], wrist) * 1.05;
  };

  const indexExtended = isExtended(8, 6);
  const middleExtended = isExtended(12, 10);
  const ringExtended = isExtended(16, 14);
  const pinkyExtended = isExtended(20, 18);
  
  // Thumb check (thumb tip distance to wrist compared to MCP joint or index base)
  const thumbExtended = getDistance(landmarks[4], wrist) > getDistance(landmarks[2], wrist) * 1.15;

  // Coordinate check for hand facing left/right
  const thumbTipToWristX = landmarks[4].x - wrist.x;

  // Let's identify shapes
  
  // 1. All open - 5 or B-like
  if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended) {
    return { gesture: "5", confidence: 95 };
  }

  // 2. Open palm but thumb folded across palm - Classic "B"
  if (indexExtended && middleExtended && ringExtended && pinkyExtended && !thumbExtended) {
    return { gesture: "B", confidence: 92 };
  }

  // 3. Fist gesture - "A" or "S" or "0"
  if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    // If thumb is extended up on the side, it's "A"
    const thumbUpward = landmarks[4].y < landmarks[3].y && getDistance(landmarks[4], landmarks[5]) < 0.2;
    if (thumbUpward) {
      return { gesture: "A", confidence: 90 };
    }
    // Standard fist or thumb tucked in front - "S" or part of standard Emergency Signal
    const thumbAcrossIndex = getDistance(landmarks[4], landmarks[6]) < 0.15;
    if (thumbAcrossIndex) {
      return { gesture: "SOS", confidence: 85 };
    }
    return { gesture: "0", confidence: 80 };
  }

  // 4. Index only - "1" or "D"
  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    // If thumb is touching middle joint - "D" else "1"
    if (getDistance(landmarks[4], landmarks[10]) < 0.15) {
      return { gesture: "D", confidence: 88 };
    }
    return { gesture: "1", confidence: 95 };
  }

  // 5. Index and Middle - "2" or "V" or "K"
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    const tipDistance = getDistance(landmarks[8], landmarks[12]);
    // Spread apart -> V or 2. Close together -> U
    if (tipDistance > 0.12) {
      // If thumb touching middle joint knuckle, it is "K", else "V"
      if (getDistance(landmarks[4], landmarks[10]) < 0.12) {
        return { gesture: "K", confidence: 85 };
      }
      return { gesture: "V", confidence: 94 };
    } else {
      return { gesture: "U", confidence: 92 };
    }
  }

  // 6. Thumb, Index, Middle Extended - "3"
  if (thumbExtended && indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return { gesture: "3", confidence: 95 };
  }

  // 7. Four fingers Extended, Thumb Tucked - "4"
  if (indexExtended && middleExtended && ringExtended && pinkyExtended && !thumbExtended) {
    return { gesture: "4", confidence: 95 };
  }

  // 8. L sign: Thumb and Index extended, middle, ring, pinky folded - "L"
  if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return { gesture: "L", confidence: 96 };
  }

  // 9. Y sign (Shaka): Thumb and Pinky extended, index, middle, ring folded - "Y"
  if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
    return { gesture: "Y", confidence: 96 };
  }

  // 10. Pinky only extended - "I" or "J"
  if (pinkyExtended && !indexExtended && !middleExtended && !ringExtended && !thumbExtended) {
    return { gesture: "I", confidence: 90 };
  }

  // 11. OK Sign: Thumb and Index touching, others extended - "F" / "9"
  const indexThumbTouching = getDistance(landmarks[8], landmarks[4]) < 0.08;
  if (indexThumbTouching && middleExtended && ringExtended && pinkyExtended) {
    return { gesture: "F", confidence: 91 };
  }

  // 12. "W" Gesture: index, middle, ring extended, pinky closed
  if (indexExtended && middleExtended && ringExtended && !pinkyExtended) {
    return { gesture: "W", confidence: 92 };
  }

  // 13. "EMERGENCY / SOS Signal" transition state detector:
  // If thumb tucked tightly over normal fist, or pinky/index folded to meet thumb, or claw shape.
  // We'll handle this by letting this heuristic trigger SOS with 90% confidence or defer to custom training.

  return null;
}

// KNN classifier: Compares live norm landmarks against all custom templates
export function classifyKNearest(liveNorm: Landmark[], templates: CustomGestureTemplate[]): { gesture: string; confidence: number } | null {
  if (templates.length === 0) return null;

  let bestMatch: CustomGestureTemplate | null = null;
  let highestConfidence = 0;

  for (const t of templates) {
    const similarity = evaluateSimilarity(liveNorm, t.landmarks);
    if (similarity > highestConfidence) {
      highestConfidence = similarity;
      bestMatch = t;
    }
  }

  // Only return matches with a reasonable confidence threshold (e.g. 55% similarity)
  if (bestMatch && highestConfidence >= 55) {
    return {
      gesture: bestMatch.name,
      confidence: highestConfidence,
    };
  }

  return null;
}

// Track movement speed (velocity vector) of hand wrist to determine excitement and emotions
export interface MotionMetrics {
  velocity: number;
  jerk: number;
}

let lastWristPos: Landmark | null = null;
let lastVelocity = 0;
let lastTime = 0;

export function analyzeEmotionAndSpeed(wrist: Landmark, confidence: number, activeGesture: string): { emotion: string; speedIndicator: string } {
  const currentTime = Date.now();
  if (!lastWristPos || lastTime === 0) {
    lastWristPos = wrist;
    lastTime = currentTime;
    return { emotion: "Calm", speedIndicator: "Low Action" };
  }

  const dt = (currentTime - lastTime) / 1000; // seconds
  if (dt <= 0.02) {
    // filter rapid duplicate calls
    return {
      emotion: lastVelocity > 0.5 ? "Expressive" : "Calm",
      speedIndicator: lastVelocity > 0.5 ? "High Velocity" : "Low Action"
    };
  }

  const dx = wrist.x - lastWristPos.x;
  const dy = wrist.y - lastWristPos.y;
  const dz = wrist.z - lastWristPos.z;
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
  
  const velocity = dist / dt; // screen distance units per second
  lastWristPos = wrist;
  lastTime = currentTime;
  lastVelocity = velocity;

  let emotion = "Calm";
  let speedIndicator = "Subtle";

  const isSOS = ["SOS", "HELP", "DANGER"].includes(activeGesture.toUpperCase());

  if (velocity > 1.2) {
    emotion = isSOS ? "Distressed" : "Excited";
    speedIndicator = "Sudden Motion";
  } else if (velocity > 0.5) {
    emotion = isSOS ? "Apprehensive" : "Expressive";
    speedIndicator = "Moderate Gesturing";
  } else {
    emotion = isSOS ? "Tense" : "Calm / Steady";
    speedIndicator = "Slow Motion";
  }

  return { emotion, speedIndicator };
}

// Convert translated phrase into Speech using the browser's native SpeechSynthesis API
// This allows adjustments to speed, volume, and multilingual voice selection client-side.
export function speakText(text: string, langCode: string = "en", rate: number = 1.0) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // Cancel any ongoing speaking
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate; // 0.5 to 2.0
  
  // Set voice locale map
  const langVoiceMap: Record<string, string> = {
    "English": "en-US",
    "Hindi": "hi-IN",
    "Bengali": "bn-IN",
    "Marathi": "mr-IN"
  };

  utterance.lang = langVoiceMap[langCode] || "en-US";

  // Try to find a matched browser voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang.startsWith(utterance.lang) || v.lang.includes(utterance.lang));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
}
