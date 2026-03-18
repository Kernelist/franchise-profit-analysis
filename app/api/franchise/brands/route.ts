import { NextRequest, NextResponse } from "next/server";

const BASE = "https://apis.data.go.kr/1130000/FftcBrandFrcsStatsService/getBrandFrcsStats";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yr = searchParams.get("yr") || "2022";
  const search = searchParams.get("search") || "";
  const industryClass = searchParams.get("industryClass") || "";
  const numOfRows = searchParams.get("numOfRows") || "500";

  const key = process.env.FTC_API_KEY;
  if (!key) return NextResponse.json({ error: "FTC_API_KEY not set" }, { status: 500 });

  try {
    // 전체 10185개 브랜드를 커버하기 위해 2페이지 병렬 조회
    const [res1, res2] = await Promise.all([
      fetch(`${BASE}?serviceKey=${key}&pageNo=1&numOfRows=5000&yr=${yr}&resultType=json`),
      fetch(`${BASE}?serviceKey=${key}&pageNo=2&numOfRows=5000&yr=${yr}&resultType=json`),
    ]);
    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

    if (data1.resultCode !== "00") {
      return NextResponse.json({ error: data1.resultMsg }, { status: 400 });
    }

    let items = [...(data1.items || []), ...(data2.items || [])];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (item: any) =>
          item.brandNm?.toLowerCase().includes(q) ||
          item.corpNm?.toLowerCase().includes(q)
      );
    }

    if (industryClass) {
      items = items.filter((item: any) =>
        item.indutyLclasNm?.includes(industryClass)
      );
    }

    return NextResponse.json({
      totalCount: data1.totalCount,
      items: items.map((item: any) => ({
        corpNm: item.corpNm,
        brandNm: item.brandNm,
        indutyLclasNm: item.indutyLclasNm,
        indutyMlsfcNm: item.indutyMlsfcNm,
        frcsCnt: item.frcsCnt,
        avrgSlsAmt: item.avrgSlsAmt,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
