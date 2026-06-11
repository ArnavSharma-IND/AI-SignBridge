import { useState } from "react";
import { UserStats, TranslationHistoryItem } from "../types";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { BarChart2, PieChart as PieIcon, Download, Trash2, Calendar, TrendingUp, Sparkles, AlertCircle } from "lucide-react";

interface DashboardProps {
  stats: UserStats;
  history: TranslationHistoryItem[];
  onClearHistory: () => void;
  accessibilityLargeText: boolean;
}

export default function Dashboard({ stats, history, onClearHistory, accessibilityLargeText }: DashboardProps) {
  const [exporting, setExporting] = useState(false);

  // Colors for our pie chart
  const COLORS = ["#0d9488", "#3b82f6", "#a855f7", "#ef4444"];

  // Format CSV helper
  const exportToCSV = () => {
    setExporting(true);
    try {
      const headers = ["ID", "Timestamp", "Source Mode", "Raw Translation", "Gemini Corrected Text", "Confidence Score (%)", "Emotion", "Language"];
      const rows = history.map((h) => [
        h.id,
        new Date(h.timestamp).toLocaleString(),
        h.context,
        h.originalGestureChain.join(" "),
        h.correctedText,
        h.confidence,
        h.emotion,
        h.language,
      ]);

      const csvContent = [headers, ...rows]
        .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `AI_SignBridge_Translation_History_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV Export error", err);
    } finally {
      setExporting(false);
    }
  };

  // Format Text Report export
  const exportToTextReport = () => {
    setExporting(true);
    try {
      let report = `========================================================\n`;
      report += `            AI SIGNBRIDGE TRANSLATION REPORT           \n`;
      report += `========================================================\n`;
      report += `Generated at: ${new Date().toLocaleString()}\n`;
      report += `Total Gestures Processes: ${stats.gesturesTranslatedCount}\n`;
      report += `Average Matching Accuracy: ${stats.accuracyRate}%\n`;
      report += `========================================================\n\n`;
      
      report += `CHRONOLOGICAL TRANSLATION HISTORY:\n\n`;
      history.forEach((h, idx) => {
        report += `${idx + 1}. [${new Date(h.timestamp).toLocaleString()}]\n`;
        report += `   Target Language:  ${h.language}\n`;
        report += `   Raw Gesture Chain: ${h.originalGestureChain.join(" ") || h.rawInput}\n`;
        report += `   Corrected Output: "${h.correctedText}"\n`;
        report += `   Confidence Match: ${h.confidence}%\n`;
        report += `   Emotion Tone:     ${h.emotion}\n`;
        report += `   Context Track:    ${h.context}\n`;
        if (h.isEmergency) {
          report += `   *** EMERGENCY TRIGGER MET ***\n`;
        }
        report += `--------------------------------------------------------\n`;
      });

      const blob = new Blob([report], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `AI_SignBridge_Full_Report_${Date.now()}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Text Report Export error", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`space-y-6 ${accessibilityLargeText ? "text-lg" : "text-sm"}`} id="analytics-dashboard">
      
      {/* Upper Cards Rows */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-xl relative overflow-hidden" id="card-translated">
          <div className="absolute right-3 top-3 opacity-10">
            <Sparkles className="w-16 h-16 text-teal-400" />
          </div>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Gestures Translated</div>
          <div className="text-3xl font-extrabold text-teal-400 mt-2">{stats.gesturesTranslatedCount}</div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
            <span>+12% incremental increase today</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-xl relative overflow-hidden" id="card-accuracy">
          <div className="absolute right-3 top-3 opacity-10">
            <TrendingUp className="w-16 h-16 text-blue-400" />
          </div>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Average Match Accuracy</div>
          <div className="text-3xl font-extrabold text-blue-400 mt-2">{stats.accuracyRate}%</div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-400"></span>
            <span>Optimized via calibration model</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-xl relative overflow-hidden" id="card-learned">
          <div className="absolute right-3 top-3 opacity-10">
            <Calendar className="w-16 h-16 text-purple-400" />
          </div>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Signs Mastered</div>
          <div className="text-3xl font-extrabold text-purple-400 mt-2">{stats.correctlyLearnedCount}</div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <span>Progress in Lesson Studio</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-xl relative overflow-hidden" id="card-sessions">
          <div className="absolute right-3 top-3 opacity-10">
            <BarChart2 className="w-16 h-16 text-indigo-400" />
          </div>
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Translations</div>
          <div className="text-3xl font-extrabold text-indigo-400 mt-2">{history.length}</div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <span>Logged keyframe sequences</span>
          </div>
        </div>

      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Daily Gestures count */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 backdrop-blur-xl" id="daily-activity-chart">
          <h3 className="text-md font-bold text-slate-100 mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-teal-400" />
            Daily Signing Volume
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyDistribution}>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }}
                  labelStyle={{ color: "#f8fafc", fontWeight: "bold" }}
                  itemStyle={{ color: "#2dd4bf" }}
                />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Weight distribution */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 backdrop-blur-xl" id="category-distribution-chart">
          <h3 className="text-md font-bold text-slate-100 mb-4 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-teal-400" />
            Gesture Category Weight
          </h3>
          <div className="h-64 w-full flex items-center justify-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }}
                    itemStyle={{ color: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Pie Legend */}
            <div className="w-1/2 flex flex-col gap-2 pl-4">
              {stats.categoryDistribution.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="font-semibold">{entry.name}:</span>
                  <span className="text-slate-400">({entry.value} occurrences)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* History Log Panel */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 backdrop-blur-xl" id="translation-history-panel">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Translation Logs</h3>
            <p className="text-xs text-slate-400 mt-1">Review, audit, and export real-time camera translation history logs</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportToCSV}
              disabled={history.length === 0 || exporting}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors"
              id="btn-export-csv"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={exportToTextReport}
              disabled={history.length === 0 || exporting}
              className="flex items-center gap-2 bg-teal-950/40 hover:bg-teal-900/60 border border-teal-800/60 disabled:opacity-40 text-teal-300 text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors"
              id="btn-export-text"
            >
              <Download className="w-4 h-4" />
              Download Full Report
            </button>
            <button
              onClick={onClearHistory}
              disabled={history.length === 0}
              className="flex items-center gap-2 bg-red-950/40 hover:bg-red-900/60 border border-red-900 px-3 py-2 disabled:opacity-40 text-red-400 text-xs rounded-lg cursor-pointer transition-colors"
              id="btn-clear-history"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Logs
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-slate-400">No Logs Logged Yet</h4>
            <p className="text-xs text-slate-500 mt-1">Start gesturing in the Live Translator to populate translation data maps.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Source / Mode</th>
                  <th className="py-2.5 px-3">Target Lang</th>
                  <th className="py-2.5 px-3">Gesture Train</th>
                  <th className="py-2.5 px-3">Gemini Refined Translation</th>
                  <th className="py-2.5 px-3">Similarity</th>
                  <th className="py-2.5 px-3 text-right">Tone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/20 transition-colors ${item.isEmergency ? "bg-red-950/20 text-red-200" : ""}`}
                  >
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString() || "Live Feed"}
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-teal-400">{item.context}</td>
                    <td className="py-3 px-3">{item.language}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                      {item.originalGestureChain.join(" ") || "Single Gesture"}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200 max-w-sm">
                      {item.correctedText}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full"
                            style={{ width: `${item.confidence}%` }}
                          ></div>
                        </div>
                        <span>{item.confidence}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.emotion === "Distressed" || item.isEmergency
                          ? "bg-red-500/20 text-red-400"
                          : item.emotion === "Excited"
                          ? "bg-purple-500/20 text-purple-400"
                          : item.emotion === "Expressive"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-teal-500/20 text-teal-400"
                      }`}>
                        {item.emotion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
