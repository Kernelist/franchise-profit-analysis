"use client";

import { useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import BrandSearch from "./BrandSearch";

const REGIONS = ["서울","경기","부산","대구","인천","광주","대전","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주"];

const MIN_WAGE = 10320; // 2026년 최저시급

const EXPENSE_RATIOS: Record<string, { label: string; ratio: number; color: string }[]> = {
  외식: [
    { label: "재료비",     ratio: 0.30, color: "#f87171" },
    { label: "임차료",     ratio: 0.12, color: "#fbbf24" },
    { label: "로열티",     ratio: 0.05, color: "#a78bfa" },
    { label: "관리비+공과금", ratio: 0.05, color: "#60a5fa" },
    { label: "기타",       ratio: 0.03, color: "#94a3b8" },
  ],
  서비스: [
    { label: "재료비",     ratio: 0.10, color: "#f87171" },
    { label: "임차료",     ratio: 0.15, color: "#fbbf24" },
    { label: "로열티",     ratio: 0.05, color: "#a78bfa" },
    { label: "관리비+공과금", ratio: 0.05, color: "#60a5fa" },
    { label: "기타",       ratio: 0.05, color: "#94a3b8" },
  ],
  도소매: [
    { label: "매입원가",   ratio: 0.50, color: "#f87171" },
    { label: "임차료",     ratio: 0.10, color: "#fbbf24" },
    { label: "로열티",     ratio: 0.03, color: "#a78bfa" },
    { label: "관리비+공과금", ratio: 0.04, color: "#60a5fa" },
    { label: "기타",       ratio: 0.03, color: "#94a3b8" },
  ],
};

const fmt = (v: number) => `${v.toLocaleString()}만원`;
const toMan = (cheonWon: number) => Math.round(cheonWon / 10);

interface Brand { corpNm: string; brandNm: string; indutyLclasNm: string; indutyMlsfcNm: string; frcsCnt: number; }

export default function Dashboard({ embedded = false }: { embedded?: boolean }) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [region, setRegion] = useState("");
  const [employeeCount, setEmployeeCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const analyze = async () => {
    if (!brand || !region) return;
    setLoading(true); setError(""); setResult(null);

    try {
      const cls = brand.indutyLclasNm;
      const name = brand.indutyMlsfcNm;

      const [salesRes, costsRes] = await Promise.all([
        fetch(`/api/franchise/regional-sales?industryClass=${encodeURIComponent(cls)}&industryName=${encodeURIComponent(name)}&region=${encodeURIComponent(region)}`),
        fetch(`/api/franchise/startup-costs?industryClass=${encodeURIComponent(cls)}&industryName=${encodeURIComponent(name)}`),
      ]);

      const salesData = await salesRes.json();
      const costsData = await costsRes.json();

      const salesItem = salesData.items?.[0];
      const costsItem = costsData.items?.[0];

      if (!salesItem) { setError(`${region} 지역의 ${name} 업종 매출 데이터가 없습니다.`); return; }
      if (!costsItem) { setError(`${name} 업종의 창업비용 데이터가 없습니다.`); return; }

      const monthlyRevenue = toMan(salesItem.monthlyAvgSales);
      const ratios = EXPENSE_RATIOS[cls] || EXPENSE_RATIOS["외식"];
      const laborCost = Math.round(MIN_WAGE * 8 * 25 * employeeCount / 10000);
      const expenses = [
        { label: "인건비", amount: laborCost, color: "#fb923c", ratio: monthlyRevenue > 0 ? laborCost / monthlyRevenue : 0, isLabor: true },
        ...ratios.map((r) => ({
          ...r,
          amount: Math.round(monthlyRevenue * r.ratio),
          isLabor: false,
        })),
      ];
      const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
      const netProfit = monthlyRevenue - totalExpense;
      const netProfitRate = monthlyRevenue > 0 ? ((netProfit / monthlyRevenue) * 100).toFixed(1) : "0";
      const startupTotal = toMan(costsItem.smtnAmt);
      const recoveryMonths = netProfit > 0 ? Math.ceil(startupTotal / netProfit) : null;

      setResult({
        monthlyRevenue,
        annualRevenue: toMan(salesItem.annualAvgSales),
        employeeCount,
        startup: {
          franchise: toMan(costsItem.avrgFrcsAmt),
          deposit: toMan(costsItem.avrgFntnAmt),
          other: toMan(costsItem.avrgJngEtcAmt),
          total: startupTotal,
        },
        expenses,
        totalExpense,
        netProfit,
        netProfitRate,
        recoveryMonths,
        cls,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startupPieData = result ? [
    { name: "가맹비",   value: result.startup.franchise, color: "#60a5fa" },
    { name: "보증금",   value: result.startup.deposit,   color: "#34d399" },
    { name: "인테리어+교육비", value: result.startup.other, color: "#f472b6" },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {!embedded && (
        <div className="border-b border-gray-800 px-6 py-4">
          <h1 className="text-xl font-bold text-white">프랜차이즈 창업 수익 분석</h1>
          <p className="text-gray-400 text-sm mt-0.5">공정거래위원회 가맹사업정보 기반 예상 수익 시뮬레이터</p>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search Panel */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">브랜드 & 지역 선택</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 mb-1.5 block">브랜드 검색</label>
              <BrandSearch onSelect={setBrand} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">지역 선택</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">지역 선택</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-end gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">고용 인원수</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 bg-gray-800 border border-gray-600 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500 text-center"
                />
                <span className="text-gray-400 text-sm">명</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 pb-3">
              2026년 최저시급 10,320원 · 1인당 월 {(MIN_WAGE * 8 * 25 / 10000).toFixed(1)}만원 (8h × 25일)
            </p>
          </div>

          {brand && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-gray-400">선택:</span>
              <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded text-xs font-medium">{brand.brandNm}</span>
              <span className="text-gray-500">({brand.indutyLclasNm} · {brand.indutyMlsfcNm})</span>
            </div>
          )}

          <button
            onClick={analyze}
            disabled={!brand || !region || loading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? "분석 중..." : "분석 시작"}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">{error}</div>
        )}

        {result && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "예상 월매출", value: fmt(result.monthlyRevenue), sub: `연 ${fmt(result.annualRevenue)}`, color: "text-blue-400" },
                { label: "총 창업비용", value: fmt(result.startup.total), sub: "가맹비+보증금+기타", color: "text-yellow-400" },
                { label: "예상 월순이익", value: fmt(result.netProfit), sub: `순이익률 ${result.netProfitRate}%`, color: result.netProfit >= 0 ? "text-green-400" : "text-red-400" },
                { label: "창업비용 회수", value: result.recoveryMonths ? `${result.recoveryMonths}개월` : "-", sub: result.recoveryMonths ? `약 ${(result.recoveryMonths / 12).toFixed(1)}년` : "수익 발생 시", color: "text-purple-400" },
              ].map((card, i) => (
                <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                  <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* 창업 초기 비용 Pie */}
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">창업 초기 비용 구성</h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {startupPieData.map((d) => (
                    <div key={d.name} className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-400">{d.name}</div>
                      <div className="text-sm font-bold mt-1" style={{ color: d.color }}>{fmt(d.value)}</div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={startupPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {startupPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 월별 고정지출 Bar */}
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-1">월별 예상 고정지출 내역</h3>
                <p className="text-xs text-gray-500 mb-4">월매출 {fmt(result.monthlyRevenue)} 기준 업계 평균 비율 적용</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={result.expenses} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}만`} />
                    <YAxis type="category" dataKey="label" tick={{ fill: "#d1d5db", fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {result.expenses.map((e: any, i: number) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 수익 요약 */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">월별 수익 요약</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">예상 월매출</span>
                  <span className="text-blue-400 font-semibold">{fmt(result.monthlyRevenue)}</span>
                </div>
                {result.expenses.map((e: any) => (
                  <div key={e.label} className="flex justify-between items-center py-1.5">
                    <span className="text-gray-500 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
                      {e.label}
                      {e.isLabor
                        ? <span className="text-gray-600">({result.employeeCount}명 × 206.4만원)</span>
                        : <span>({(e.ratio * 100).toFixed(0)}%)</span>
                      }
                    </span>
                    <span className="text-gray-300 text-sm">- {fmt(e.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2 border-t border-gray-600 mt-2">
                  <span className="text-gray-300 font-semibold text-sm">총 고정지출</span>
                  <span className="text-red-400 font-semibold">- {fmt(result.totalExpense)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t-2 border-gray-500">
                  <span className="text-white font-bold">예상 월순이익</span>
                  <span className={`font-bold text-lg ${result.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmt(result.netProfit)} ({result.netProfitRate}%)
                  </span>
                </div>
              </div>
            </div>

            {/* 출처 */}
            <p className="text-center text-xs text-gray-600">
              ※ 공정거래위원회 가맹사업정보 2022년 기준 업계 평균 추정치 · 실제 수익은 운영 조건에 따라 상이할 수 있습니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
