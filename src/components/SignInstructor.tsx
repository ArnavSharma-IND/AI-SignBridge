import { useState, useEffect } from "react";
import { Landmark, LearningLesson, QuizQuestion } from "../types";
import { Award, BookOpen, CheckCircle, HelpCircle, ArrowRight, Video, AlertCircle, RefreshCw } from "lucide-react";
import { speakText } from "../utils/gestureEngine";

interface SignInstructorProps {
  currentLandmarks: Landmark[] | null;
  activeGesture: string; // currently detected gesture string
  activeConfidence: number;
  onLessonSuccess: () => void;
  accessibilityLargeText: boolean;
}

const LESSONS: LearningLesson[] = [
  {
    id: "l-1",
    title: "Mastering the 'L' Shape",
    category: "alphabets",
    duration: "2 min",
    difficulty: "Beginner",
    gestures: ["L"],
    description: "Form a classic 'L' shape using your hand. This is the foundation for spelling and casual gestures.",
  },
  {
    id: "l-2",
    title: "The Shaka 'Y' Connection",
    category: "alphabets",
    duration: "3 min",
    difficulty: "Beginner",
    gestures: ["Y"],
    description: "Extend your thumb and pinky finger while keeping index, middle, and ring fingers folded tight.",
  },
  {
    id: "l-3",
    title: "V Sign and Number 2",
    category: "numbers",
    duration: "2 min",
    difficulty: "Beginner",
    gestures: ["V"],
    description: "The classic peace sign. Extend index and middle fingers wide while keeping the thumb folded.",
  },
  {
    id: "l-4",
    title: "Standard Emergency SOS Sign",
    category: "emergency",
    duration: "5 min",
    difficulty: "Intermediate",
    gestures: ["SOS"],
    description: "A vital rescue coordinate gesture consisting of a closed fist with thumb wrapping standard knuckles.",
  }
];

const QUIZZES: QuizQuestion[] = [
  {
    id: "q-1",
    prompt: "Pose the sign for 'L' (Index pointing straight up, thumb pointing horizontal).",
    type: "pose",
    targetGesture: "L",
  },
  {
    id: "q-2",
    prompt: "Pose the sign for 'Y' (Thumb and Pinky extended wide, others folded).",
    type: "pose",
    targetGesture: "Y",
  },
  {
    id: "q-3",
    prompt: "Pose the sign for number '3' (Thumb, Index and Middle fingers extended).",
    type: "pose",
    targetGesture: "3",
  },
  {
    id: "q-4",
    prompt: "In sign language, how is an emergency SOS or HELP signal represented?",
    type: "multiple-choice",
    targetGesture: "SOS",
    options: [
      "Waving hands vigorously sideways",
      "Clenching other hand tight with two index fingers crossed",
      "An open palm turning into a closed fist wrapping the thumb",
      "Pointing both thumbs down"
    ],
    correctAnswer: "An open palm turning into a closed fist wrapping the thumb"
  }
];

export default function SignInstructor({
  currentLandmarks,
  activeGesture,
  activeConfidence,
  onLessonSuccess,
  accessibilityLargeText,
}: SignInstructorProps) {
  const [selectedLesson, setSelectedLesson] = useState<LearningLesson | null>(LESSONS[0]);
  const [activeTab, setActiveTab] = useState<"lessons" | "quiz">("lessons");
  
  // Quiz state
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [selectedMCAnswer, setSelectedMCAnswer] = useState("");
  const [mcCorrect, setMcCorrect] = useState<boolean | null>(null);
  
  // Tracking holds for pose validation (user must hold pose for 1.5 seconds)
  const [poseHoldProgress, setPoseHoldProgress] = useState(0);
  const [validationMessage, setValidationMessage] = useState("Camera ready. Align your hand posture.");

  const currentQuiz = QUIZZES[currentQuizIdx];

  // Dynamic Joint-by-joint AI Feedback logic
  const getAIFeedback = (): string => {
    if (!currentLandmarks || currentLandmarks.length < 21) {
      return "No hand detected. Place your palm clearly in front of the camera skeleton layer.";
    }

    const wrist = currentLandmarks[0];
    const isExtended = (tip: number, joint: number) => {
      return getDistance(currentLandmarks[tip], wrist) > getDistance(currentLandmarks[joint], wrist) * 1.05;
    };

    const getDistance = (p1: Landmark, p2: Landmark) => {
      return Math.sqrt(Math.pow(p1.x-p2.x,2) + Math.pow(p1.y-p2.y,2));
    };

    const indexExt = isExtended(8, 6);
    const middleExt = isExtended(12, 10);
    const ringExt = isExtended(16, 14);
    const pinkyExt = isExtended(20, 18);
    const thumbExt = getDistance(currentLandmarks[4], wrist) > getDistance(currentLandmarks[2], wrist) * 1.15;

    const target = activeTab === "lessons" ? selectedLesson?.gestures[0] : currentQuiz?.targetGesture;

    if (!target) return "No active targets loaded.";

    // Feedback calculations based on targeted pose alignment
    if (target === "L") {
      if (!thumbExt && !indexExt) {
        return "AI Feedback: Guide - Extend both your thumb and index fingers outwards.";
      }
      if (!indexExt) {
        return "AI Feedback: Guide - Point your index finger straight UP.";
      }
      if (!thumbExt) {
        return "AI Feedback: Guide - Point your thumb straight OUT horizontally.";
      }
      if (middleExt || ringExt || pinkyExt) {
        return "AI Feedback: Guide - Fold your middle, ring, and pinky fingers flat against your palm.";
      }
      return "Excellent! Pose is highly aligned. Hold it tight to capture!";
    }

    if (target === "Y") {
      if (!thumbExt || !pinkyExt) {
        return "AI Feedback: Guide - Fully extend both your thumb and pinky finger wide.";
      }
      if (indexExt || middleExt || ringExt) {
        return "AI Feedback: Guide - Ensure you fold down your index, middle, and ring fingers completely.";
      }
      return "Excellent! Perfect shaka alignment. Hold for the win.";
    }

    if (target === "V") {
      if (!indexExt || !middleExt) {
        return "AI Feedback: Guide - Raise both your index and middle fingers to form a 'V'.";
      }
      if (ringExt || pinkyExt) {
        return "AI Feedback: Guide - Tighten and fold your ring and pinky fingers.";
      }
      return "Excellent V-sign alignment. Keep holding.";
    }

    if (target === "3") {
      if (!thumbExt || !indexExt || !middleExt) {
        return "AI Feedback: Guide - Raise your thumb, index, and middle fingers concurrently.";
      }
      if (ringExt || pinkyExt) {
        return "AI Feedback: Guide - Tuck in and fold your ring and pinky fingers.";
      }
      return "Excellent! 3-finger alignment matches our target values.";
    }

    if (target === "SOS") {
      if (indexExt || middleExt || ringExt || pinkyExt) {
        return "AI Feedback: Guide - Form a tight fist. Clench all four fingers completely down.";
      }
      if (!thumbExt) {
        return "AI Feedback: Guide - Wrap your thumb horizontally across your clenched fingers.";
      }
      return "Excellent! SOS Emergency Signal aligned.";
    }

    return "AI Feedback: Aligning posture coordinate grids. Hold steady.";
  };

  // Continuous monitoring for pose milestones
  useEffect(() => {
    if (activeTab === "lessons" && !selectedLesson) return;
    if (activeTab === "quiz" && (!currentQuiz || currentQuiz.type !== "pose")) return;

    const targetPose = activeTab === "lessons" 
      ? selectedLesson?.gestures[0] 
      : currentQuiz?.targetGesture;

    if (!targetPose) return;

    const cleanedActive = activeGesture.trim().toUpperCase();
    const cleanedTarget = targetPose.trim().toUpperCase();

    let isMatch = cleanedActive === cleanedTarget && activeConfidence >= 65;
    
    // In lessons or quiz pose, check fallback or direct similarity
    if (isMatch) {
      setValidationMessage("Posture Match Confirmed! Calibrating keyframe hold...");
      const interval = setInterval(() => {
        setPoseHoldProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            speakText("Success! Gesture mastered.", "English", 1.1);
            
            if (activeTab === "lessons") {
              onLessonSuccess();
              setValidationMessage("Lesson completed! Excellent work.");
            } else {
              setQuizScore((s) => s + 1);
              handleNextQuiz();
              setValidationMessage("Quiz pose successfully captured!");
            }
            return 0;
          }
          return p + 10;
        });
      }, 150);

      return () => clearInterval(interval);
    } else {
      setPoseHoldProgress(0);
      setValidationMessage(getAIFeedback());
    }
  }, [activeGesture, activeConfidence, selectedLesson, currentQuizIdx, activeTab, currentLandmarks]);

  const handleNextQuiz = () => {
    setSelectedMCAnswer("");
    setMcCorrect(null);
    setPoseHoldProgress(0);
    if (currentQuizIdx < QUIZZES.length - 1) {
      setCurrentQuizIdx((i) => i + 1);
    } else {
      setIsQuizFinished(true);
    }
  };

  const submitMCAnswer = (ans: string) => {
    setSelectedMCAnswer(ans);
    const isCorr = ans === currentQuiz.correctAnswer;
    setMcCorrect(isCorr);
    if (isCorr) {
      setQuizScore((s) => s + 1);
      speakText("Correct answer!", "English", 1.0);
    } else {
      speakText("Incorrect, try again.", "English", 1.0);
    }
  };

  const restartQuiz = () => {
    setCurrentQuizIdx(0);
    setQuizScore(0);
    setIsQuizFinished(false);
    setSelectedMCAnswer("");
    setMcCorrect(null);
    setPoseHoldProgress(0);
  };

  return (
    <div className={`space-y-6 ${accessibilityLargeText ? "text-lg" : "text-sm"}`} id="learning-studio-workspace">
      
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => {
            setActiveTab("lessons");
            setPoseHoldProgress(0);
          }}
          className={`flex-1 py-3 text-center border-b-2 font-bold transition-all text-xs flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "lessons" ? "border-teal-400 text-teal-400 font-extrabold" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-lessons"
        >
          <BookOpen className="w-4 h-4" />
          Interactive Lessons
        </button>
        <button
          onClick={() => {
            setActiveTab("quiz");
            setPoseHoldProgress(0);
          }}
          className={`flex-1 py-3 text-center border-b-2 font-bold transition-all text-xs flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "quiz" ? "border-teal-400 text-teal-400 font-extrabold" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-quiz"
        >
          <Award className="w-4 h-4" />
          Pose Calibration &amp; Quizzes
        </button>
      </div>

      {activeTab === "lessons" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="learning-lessons-subview">
          
          {/* Lessons list */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider pl-1">Available Syllabus Syllabus</h3>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {LESSONS.map((lesson) => (
                <div
                  key={lesson.id}
                  onClick={() => {
                    setSelectedLesson(lesson);
                    setPoseHoldProgress(0);
                  }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedLesson?.id === lesson.id
                      ? "bg-teal-500/10 border-teal-500"
                      : "bg-slate-900/40 border-slate-800 hover:bg-slate-850/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      lesson.category === "emergency"
                        ? "bg-red-500/20 text-red-400"
                        : lesson.category === "numbers"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-teal-500/20 text-teal-300"
                    }`}>
                      {lesson.category}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">{lesson.duration}</span>
                  </div>
                  <h4 className="font-bold text-slate-200 text-xs">{lesson.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{lesson.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Active Lesson practice board */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-xl flex flex-col justify-between">
            {selectedLesson ? (
              <div className="space-y-5" id="active-lesson-practice">
                <div className="pb-3 border-b border-slate-800">
                  <span className="text-[10px] text-teal-400 font-mono tracking-wider font-semibold uppercase">{selectedLesson.difficulty} Lesson</span>
                  <h3 className="text-xl font-bold text-slate-100 mt-1">{selectedLesson.title}</h3>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 leading-relaxed text-xs text-slate-300">
                  {selectedLesson.description}
                </div>

                <div className="bg-slate-950 rounded-xl p-5 border border-slate-850 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">Target Sign Pose</h4>
                      <div className="text-4xl font-black text-teal-400 mt-2 tracking-tighter" id="target-sign-label">
                        {selectedLesson.gestures[0]}
                      </div>
                    </div>
                    {/* Visual alignment meter */}
                    <div className="text-right">
                      <div className="text-xs font-mono text-slate-400">Pose Matching Hold</div>
                      <div className="text-xl font-black text-blue-400 mt-1 font-mono">{poseHoldProgress}%</div>
                    </div>
                  </div>

                  {/* Hold indicator progress-bar */}
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-400 h-full transition-all duration-150 rounded-full"
                      style={{ width: `${poseHoldProgress}%` }}
                    ></div>
                  </div>
                </div>

                {/* AI Interactive Feedback alert */}
                <div className="p-4 rounded-xl flex gap-3 text-xs bg-slate-950/40 border border-slate-850">
                  <Video className="w-5 h-5 text-teal-400 flex-shrink-0 animate-pulse" />
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-200">AI Instructor Feedback:</div>
                    <p className="text-[11px] leading-relaxed text-slate-400" id="lesson-feedback-text">
                      {validationMessage}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-slate-400 text-xs">Select a syllabus lesson from the sidebar menu to target training.</p>
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-xl" id="quiz-subview">
          
          {isQuizFinished ? (
            <div className="text-center py-12 space-y-5" id="quiz-finished">
              <Award className="w-16 h-16 text-teal-400 mx-auto animate-bounce" />
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-100">Quiz Completed!</h3>
                <p className="text-xs text-slate-400">Excellent progress calibrating hand gesture matching filters on camera.</p>
              </div>

              <div className="bg-slate-950/60 max-w-sm mx-auto p-5 border border-slate-800 rounded-xl">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Final Scored Points</div>
                <div className="text-5xl font-black text-teal-400 mt-2 font-mono">
                  {quizScore} <span className="text-xs text-slate-500 font-normal"> / {QUIZZES.length}</span>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Accuracy: {Math.floor((quizScore / QUIZZES.length) * 100)}% Match Index
                </div>
              </div>

              <button
                onClick={restartQuiz}
                className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 font-bold text-slate-950 text-xs px-5 py-2.5 rounded-lg cursor-pointer transition-colors"
                id="btn-restart-quiz"
              >
                <RefreshCw className="w-4 h-4" />
                Retake Quiz
              </button>
            </div>
          ) : (
            <div className="space-y-6" id="quiz-active">
              
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-md font-bold text-slate-200">Interactive Sign Challenge</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Test your live gestures accuracy index</p>
                </div>
                <span className="bg-slate-950 border border-slate-800 px-3 py-1 font-mono text-[10px] text-teal-400 rounded-full">
                  Question {currentQuizIdx + 1} of {QUIZZES.length}
                </span>
              </div>

              <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider font-bold">Challenge Instruction</div>
                <p className="text-sm font-semibold text-slate-200 leading-relaxed" id="quiz-prompt-text">{currentQuiz.prompt}</p>
              </div>

              {currentQuiz.type === "pose" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Camera pose capture track */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-[10px] font-mono uppercase text-slate-500 font-bold">Target Pose</h4>
                        <div className="text-4xl font-extrabold text-teal-400 mt-1 font-mono">{currentQuiz.targetGesture}</div>
                      </div>
                      <div className="text-right">
                        <h4 className="text-[10px] font-mono uppercase text-slate-500 font-bold">Pose Confirmed</h4>
                        <div className="text-xl font-bold font-mono text-blue-400 mt-1">{poseHoldProgress}%</div>
                      </div>
                    </div>

                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-400 h-full rounded-full transition-all duration-150"
                        style={{ width: `${poseHoldProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-5 flex flex-col justify-center space-y-2 text-xs">
                    <div className="font-semibold text-slate-300">Live Calibration Logs:</div>
                    <p className="text-slate-400 leading-relaxed text-[11px]" id="quiz-pose-feedback">
                      {validationMessage}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3" id="quiz-multiple-choice-container">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentQuiz.options?.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => submitMCAnswer(opt)}
                        disabled={selectedMCAnswer !== ""}
                        className={`text-left text-xs p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                          selectedMCAnswer === ""
                            ? "bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                            : opt === currentQuiz.correctAnswer
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                            : selectedMCAnswer === opt
                            ? "bg-red-500/10 border-red-500 text-red-300"
                            : "bg-slate-950/40 border-slate-900 text-slate-500"
                        }`}
                      >
                        <span>{opt}</span>
                        {selectedMCAnswer !== "" && opt === currentQuiz.correctAnswer && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        )}
                        {selectedMCAnswer !== "" && selectedMCAnswer === opt && opt !== currentQuiz.correctAnswer && (
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedMCAnswer !== "" && (
                    <div className="pt-4 border-t border-slate-850 flex items-center justify-between">
                      <div className="text-xs">
                        {mcCorrect ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> That is correct!
                          </span>
                        ) : (
                          <span className="text-red-400 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> Incorrect. Correct option was &quot;{currentQuiz.correctAnswer}&quot;.
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleNextQuiz}
                        className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
                        id="btn-quiz-next"
                      >
                        Next Challenge
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}
