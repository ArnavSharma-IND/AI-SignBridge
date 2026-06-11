import { useState } from "react";
import { Landmark, CustomGestureTemplate } from "../types";
import { Save, Trash2, HelpCircle, Activity, Landmark as LandmarkIcon } from "lucide-react";

interface GestureModelTrainerProps {
  currentLandmarks: Landmark[] | null;
  customTemplates: CustomGestureTemplate[];
  onAddTemplate: (name: string, landmarks: Landmark[]) => void;
  onRemoveTemplate: (id: string) => void;
  accessibilityLargeText: boolean;
}

export default function GestureModelTrainer({
  currentLandmarks,
  customTemplates,
  onAddTemplate,
  onRemoveTemplate,
  accessibilityLargeText,
}: GestureModelTrainerProps) {
  const [newGestureName, setNewGestureName] = useState("");
  const [errorText, setErrorText] = useState("");

  const handleCapture = () => {
    setErrorText("");
    if (!newGestureName.trim()) {
      setErrorText("Please provide a name or label for the custom gesture first.");
      return;
    }
    if (!currentLandmarks || currentLandmarks.length < 21) {
      setErrorText("No active hand skeleton detected. Face your hand towards the webcam first.");
      return;
    }

    // Capture current 21-point raw landmark array
    onAddTemplate(newGestureName.trim().toUpperCase(), currentLandmarks);
    setNewGestureName("");
  };

  return (
    <div className={`space-y-6 ${accessibilityLargeText ? "text-lg" : "text-sm"}`} id="gesture-trainer-panel">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Capturing Module */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-xl space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-400 animate-pulse" />
              Machine Learning Gesture Capturing Sandbox
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Train your own signs. Hold a static gesture steady with your hand in front of the camera, enter a name, and press Capture below to train the vector model.
            </p>
          </div>

          {/* Captured Landmark Indicator */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${currentLandmarks ? "bg-teal-500 animate-ping" : "bg-red-500"}`}></div>
              <div>
                <div className="font-semibold text-xs text-slate-200">
                  {currentLandmarks ? "Tracking Active" : "Camera Idle / Hand Out Of Frame"}
                </div>
                <div className="text-[10px] text-slate-400">
                  {currentLandmarks ? "21 joints streaming in 3D Euclidean space" : "Please hold your hand visible to the camera"}
                </div>
              </div>
            </div>
            
            {currentLandmarks && (
              <span className="bg-teal-500/10 border border-teal-800 text-teal-400 text-[10px] font-mono px-2 py-0.5 rounded">
                Vector 21d ready
              </span>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Gesture Label Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. HELLO, WATER, ME, SAFE, YES"
                value={newGestureName}
                onChange={(e) => setNewGestureName(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 flex-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-teal-500 transition-colors uppercase font-mono"
              />
              <button
                onClick={handleCapture}
                disabled={!currentLandmarks}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 font-semibold disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 text-xs px-4 py-2.5 rounded-lg cursor-pointer transition-colors"
                id="btn-capture-landmark"
              >
                <Save className="w-4 h-4" />
                Capture Sign
              </button>
            </div>
            {errorText && <p className="text-red-400 text-xs font-semibold">{errorText}</p>}
          </div>

          {/* Theoretical explanation on ML mapping */}
          <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/60 leading-relaxed text-xs text-slate-400 flex gap-3">
            <HelpCircle className="w-6 h-6 text-blue-400 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-200">How the KNN model classifies coordinate datasets:</h4>
              <p>
                When you press capture, AI SignBridge calculates 3D normal distance arrays. It abstracts out coordinate scaling (if your hand is close or far) and translates your wrist coordinates to (0,0,0) to remain scale and position invariant.
              </p>
              <p className="text-[11px] text-slate-500">
                A mathematical K-Nearest Neighbors (KNN) algorithm calculates vector distances with a custom weight map for fingertip coordinates to match live movements against saved vectors in real time!
              </p>
            </div>
          </div>

        </div>

        {/* Database List */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-xl flex flex-col h-full space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <LandmarkIcon className="w-5 h-5 text-teal-400" />
              Trained Gestures Database
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Stored custom frames in local browser database ({customTemplates.length} templates)
            </p>
          </div>

          {customTemplates.length === 0 ? (
            <div className="text-center py-12 flex-1 flex flex-col justify-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <h4 className="text-xs font-semibold text-slate-400">Local Vector Matrix Empty</h4>
              <p className="text-[10px] text-slate-500 mt-1 px-4 leading-normal">
                You haven&apos;t captured any custom gestures yet. Capture common signs to allow personalized classifications.
              </p>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] pr-1">
              {customTemplates.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between hover:border-slate-700 transition-all"
                >
                  <div className="space-y-1">
                    <div className="font-mono text-xs font-bold text-teal-400">{item.name}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      <span>21 Landmark joints</span>
                      <span>•</span>
                      <span>{new Date(item.recordedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveTemplate(item.id)}
                    className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-red-400 rounded-lg transition-all cursor-pointer"
                    title="Remove custom template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
