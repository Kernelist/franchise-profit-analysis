"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface CVResult {
  k: number;
  foldRMSEs: number[];
  meanRMSE: number;
  stdRMSE: number;
}

interface Coef {
  feature: string;
  coefStandardized: number;
}

interface TrainResult {
  dataCount: { total: number; train: number; test: number };
  crossValidation: CVResult;
  testRMSE: number;
  model: {
    type: string;
    features: string[];
    target: string;
    preprocessing: string;
    coefficients: Coef[];
  };
}

const fmt만원 = (v: number) => `${(v / 10).toLocaleString()}만원`;

export default function ModelAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrainResult | null>(null);
  const [error, setError] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);

  const downloadCSV = async () => {
    setCsvLoading(true);
    try {
      const res = await fetch("/api/franchise/training-data");
      if (!res.ok) throw new Error("CSV 다운로드 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "franchise_training_data_2022.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCsvLoading(false);
    }
  };

  const runTrain = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/franchise/model-train");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const coefBarData = result?.model.coefficients
    .filter((c) => c.feature !== "절편(intercept)")
    .map((c) => ({
      name: c.feature.split("(")[0],
      value: Math.abs(c.coefStandardized),
      raw: c.coefStandardized,
      color: c.coefStandardized >= 0 ? "#34d399" : "#f87171",
    }));

  const foldData = result?.crossValidation.foldRMSEs.map((v, i) => ({
    name: `Fold ${i + 1}`,
    rmse: v,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
        <h2 className="text-base font-bold text-white mb-1">회귀 모델 학습 및 검증</h2>
        <p className="text-gray-400 text-sm mb-4">
          공정거래위원회 브랜드 데이터(~10K건) · OLS 다중선형회귀 · 80/20 분할 · K-Fold CV (k=5) · RMSE 평가
        </p>

        <div className="bg-gray-800 rounded-lg p-4 mb-4 text-xs text-gray-300 space-y-1">
          <div><span className="text-gray-500">모델:</span> Multiple Linear Regression (OLS 정규방정식)</div>
          <div><span className="text-gray-500">타겟:</span> avrgSlsAmt — 브랜드별 연평균매출액 (천원)</div>
          <div><span className="text-gray-500">피처:</span> 가맹점수, 업종(서비스/도소매 더미), 평균가맹비, 평균보증금, 기타창업비</div>
          <div><span className="text-gray-500">전처리:</span> Z-score 표준화 (train 기준 fit → test 적용)</div>
          <div><span className="text-gray-500">과적합 방지:</span> 5-Fold Cross Validation</div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={runTrain}
            disabled={loading || csvLoading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                API 호출 및 모델 학습 중...
              </span>
            ) : (
              "모델 학습 시작"
            )}
          </button>
          <button
            onClick={downloadCSV}
            disabled={loading || csvLoading}
            className="px-5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-200 font-semibold py-3 rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            {csvLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                저장 중...
              </span>
            ) : (
              "원천데이터 CSV 저장"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* 데이터 & RMSE 요약 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "전체 데이터", value: `${result.dataCount.total.toLocaleString()}건`, sub: "유효 브랜드 수", color: "text-blue-400" },
              { label: "Train / Test", value: `${result.dataCount.train} / ${result.dataCount.test}`, sub: "80% / 20% 분할", color: "text-yellow-400" },
              { label: "CV RMSE (5-Fold)", value: fmt만원(result.crossValidation.meanRMSE), sub: `±${fmt만원(result.crossValidation.stdRMSE)}`, color: "text-purple-400" },
              { label: "Test RMSE", value: fmt만원(result.testRMSE), sub: "최종 홀드아웃 평가", color: result.testRMSE <= result.crossValidation.meanRMSE * 1.1 ? "text-green-400" : "text-orange-400" },
            ].map((card, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* 과적합 판정 */}
          <div className={`rounded-xl p-4 mb-6 border text-sm flex items-start gap-3 ${
            result.testRMSE <= result.crossValidation.meanRMSE * 1.15
              ? "bg-green-900/20 border-green-700 text-green-300"
              : "bg-orange-900/20 border-orange-700 text-orange-300"
          }`}>
            <span className="text-lg">{result.testRMSE <= result.crossValidation.meanRMSE * 1.15 ? "✓" : "⚠"}</span>
            <div>
              <div className="font-semibold mb-0.5">
                {result.testRMSE <= result.crossValidation.meanRMSE * 1.15 ? "과적합 없음 (양호)" : "과적합 가능성 (Test RMSE가 CV 대비 15% 초과)"}
              </div>
              <div className="text-xs opacity-80">
                CV RMSE {fmt만원(result.crossValidation.meanRMSE)} vs Test RMSE {fmt만원(result.testRMSE)} —
                차이 {((result.testRMSE / result.crossValidation.meanRMSE - 1) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 차트 행 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Fold별 RMSE */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-1">5-Fold CV RMSE</h3>
              <p className="text-xs text-gray-500 mb-4">
                평균 {fmt만원(result.crossValidation.meanRMSE)} ± {fmt만원(result.crossValidation.stdRMSE)}
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={foldData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${(v / 10).toLocaleString()}만`} />
                  <Tooltip
                    formatter={(v: any) => [fmt만원(v), "RMSE"]}
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  />
                  <Bar dataKey="rmse" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 피처 중요도 (|표준화 계수| 기준) */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-1">피처 중요도</h3>
              <p className="text-xs text-gray-500 mb-4">|표준화 계수| 기준 · 초록=양의 상관, 빨강=음의 상관</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={coefBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#d1d5db", fontSize: 11 }} width={70} />
                  <Tooltip
                    formatter={(v: any, _: any, props: any) => [
                      props.payload.raw.toFixed(2),
                      "표준화 계수",
                    ]}
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {coefBarData?.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 모델 구조 상세 */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">모델 구조 상세</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-xs">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-500 mb-1">모델 타입</div>
                <div className="text-white font-medium">{result.model.type}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-500 mb-1">전처리</div>
                <div className="text-white font-medium">{result.model.preprocessing}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-500 mb-1">타겟 변수</div>
                <div className="text-white font-medium">연평균매출액 (천원)</div>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium py-2 pr-4">피처</th>
                  <th className="text-right text-gray-400 font-medium py-2 pr-4">표준화 계수</th>
                  <th className="text-right text-gray-400 font-medium py-2">영향도</th>
                </tr>
              </thead>
              <tbody>
                {result.model.coefficients.map((c, i) => {
                  const max = Math.max(...result.model.coefficients.map((x) => Math.abs(x.coefStandardized)));
                  const pct = (Math.abs(c.coefStandardized) / max) * 100;
                  return (
                    <tr key={i} className="border-b border-gray-800">
                      <td className="py-2.5 pr-4 text-gray-300">{c.feature}</td>
                      <td className={`py-2.5 pr-4 text-right font-mono ${c.coefStandardized >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {c.coefStandardized >= 0 ? "+" : ""}{c.coefStandardized.toFixed(4)}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 bg-gray-800 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: c.coefStandardized >= 0 ? "#34d399" : "#f87171",
                              }}
                            />
                          </div>
                          <span className="text-gray-500 text-xs w-8 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-center text-xs text-gray-600 mt-4">
            ※ 공정거래위원회 가맹사업정보 2022년 기준 · RMSE 단위: 천원 · 표준화 계수 기준 피처 중요도
          </p>
        </>
      )}
    </div>
  );
}
