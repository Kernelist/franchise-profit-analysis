"use client";

import { useState } from "react";
import Dashboard from "./components/Dashboard";
import ModelAnalysis from "./components/ModelAnalysis";

export default function Home() {
  const [tab, setTab] = useState<"dashboard" | "model">("dashboard");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold text-white">프랜차이즈 창업 수익 분석</h1>
        <p className="text-gray-400 text-sm mt-0.5">공정거래위원회 가맹사업정보 기반 예상 수익 시뮬레이터</p>
        <div className="flex gap-1 mt-4">
          {(["dashboard", "model"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {t === "dashboard" ? "수익 시뮬레이터" : "회귀 모델 학습"}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" ? <Dashboard embedded /> : <ModelAnalysis />}
    </div>
  );
}
