import { NextRequest, NextResponse } from "next/server";

const ENDPOINTS: Record<string, string> = {
  외식: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnOutStats",
  서비스: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnSrvcStats",
  도소매: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnWhrtStats",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yr = searchParams.get("yr") || "2022";
  const industryClass = searchParams.get("industryClass") || "외식";
  const industryName = searchParams.get("industryName") || "";

  const key = process.env.FTC_API_KEY;
  if (!key) return NextResponse.json({ error: "FTC_API_KEY not set" }, { status: 500 });

  const endpoint = ENDPOINTS[industryClass] || ENDPOINTS["외식"];

  try {
    const url = `${endpoint}?serviceKey=${key}&pageNo=1&numOfRows=100&yr=${yr}&resultType=json`;
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

    return NextResponse.json({
      items: items.map((item: any) => ({
        indutyMlsfcNm: item.indutyMlsfcNm?.trim(),
        jnghdqrtrsCnt: item.jnghdqrtrsCnt,
        avrgFrcsAmt: item.avrgFrcsAmt,       // 평균 가맹비 (천원)
        avrgFntnAmt: item.avrgFntnAmt,       // 평균 보증금 (천원)
        avrgJngEtcAmt: item.avrgJngEtcAmt,   // 기타창업비 - 인테리어+교육비 (천원)
        smtnAmt: item.smtnAmt,               // 총 창업비용 (천원)
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
