import { NextRequest, NextResponse } from "next/server";

const ENDPOINTS: Record<string, string> = {
  외식: "https://apis.data.go.kr/1130000/FftcAreaIndutyAvrStatsService/getAreaIndutyAvrOutStats",
  서비스: "https://apis.data.go.kr/1130000/FftcAreaIndutyAvrStatsService/getAreaIndutyAvrSrvcStats",
  도소매: "https://apis.data.go.kr/1130000/FftcAreaIndutyAvrStatsService/getAreaIndutyAvrWhrtStats",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yr = searchParams.get("yr") || "2022";
  const industryClass = searchParams.get("industryClass") || "외식";
  const industryName = searchParams.get("industryName") || "";
  const region = searchParams.get("region") || "";

  const key = process.env.FTC_API_KEY;
  if (!key) return NextResponse.json({ error: "FTC_API_KEY not set" }, { status: 500 });

  const endpoint = ENDPOINTS[industryClass] || ENDPOINTS["외식"];

  try {
    const url = `${endpoint}?serviceKey=${key}&pageNo=1&numOfRows=300&yr=${yr}&resultType=json`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.resultCode !== "00") {
      return NextResponse.json({ error: data.resultMsg }, { status: 400 });
    }

    let items = data.items || [];

    if (industryName) {
      items = items.filter((item: any) =>
        item.indutyMlsfcNm?.trim() === industryName.trim()
      );
    }

    if (region) {
      items = items.filter((item: any) => item.areaNm === region);
    }

    return NextResponse.json({
      items: items.map((item: any) => ({
        indutyMlsfcNm: item.indutyMlsfcNm?.trim(),
        areaNm: item.areaNm,
        annualAvgSales: item.frcsCnt,                        // 연 평균매출 (천원)
        monthlyAvgSales: Math.round(item.frcsCnt / 12),      // 월 평균매출 (천원)
        arUnitAvrgSlsAmt: item.arUnitAvrgSlsAmt,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
