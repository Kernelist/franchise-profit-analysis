import { NextResponse } from "next/server";

const BRANDS_URL =
  "https://apis.data.go.kr/1130000/FftcBrandFrcsStatsService/getBrandFrcsStats";

const COST_ENDPOINTS: Record<string, string> = {
  외식: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnOutStats",
  서비스: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnSrvcStats",
  도소매: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnWhrtStats",
};

function toCSV(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const v = String(row[h] ?? "");
          return v.includes(",") ? `"${v}"` : v;
        })
        .join(",")
    ),
  ];
  return "\uFEFF" + lines.join("\r\n"); // UTF-8 BOM (Excel 한글 깨짐 방지)
}

export async function GET() {
  const key = process.env.FTC_API_KEY;
  if (!key)
    return NextResponse.json({ error: "FTC_API_KEY not set" }, { status: 500 });

  try {
    const [b1, b2, c외식, c서비스, c도소매] = await Promise.all([
      fetch(`${BRANDS_URL}?serviceKey=${key}&pageNo=1&numOfRows=5000&yr=2022&resultType=json`).then((r) => r.json()),
      fetch(`${BRANDS_URL}?serviceKey=${key}&pageNo=2&numOfRows=5000&yr=2022&resultType=json`).then((r) => r.json()),
      fetch(`${COST_ENDPOINTS["외식"]}?serviceKey=${key}&pageNo=1&numOfRows=200&yr=2022&resultType=json`).then((r) => r.json()),
      fetch(`${COST_ENDPOINTS["서비스"]}?serviceKey=${key}&pageNo=1&numOfRows=200&yr=2022&resultType=json`).then((r) => r.json()),
      fetch(`${COST_ENDPOINTS["도소매"]}?serviceKey=${key}&pageNo=1&numOfRows=200&yr=2022&resultType=json`).then((r) => r.json()),
    ]);

    const brands: any[] = [...(b1.items || []), ...(b2.items || [])];

    const costMap = new Map<string, { frcs: number; fntn: number; etc: number; smtn: number }>();
    for (const raw of [c외식, c서비스, c도소매]) {
      for (const item of raw.items || []) {
        const nm = item.indutyMlsfcNm?.trim();
        if (!nm) continue;
        costMap.set(nm, {
          frcs: Number(item.avrgFrcsAmt) || 0,
          fntn: Number(item.avrgFntnAmt) || 0,
          etc: Number(item.avrgJngEtcAmt) || 0,
          smtn: Number(item.smtnAmt) || 0,
        });
      }
    }

    const rows: Record<string, string | number>[] = [];

    for (const b of brands) {
      const target = Number(b.avrgSlsAmt);
      if (!target || target <= 0) continue;

      const cls = b.indutyLclasNm || "";
      const nm = b.indutyMlsfcNm?.trim() || "";
      const costs = costMap.get(nm) ?? { frcs: 0, fntn: 0, etc: 0, smtn: 0 };

      rows.push({
        corpNm: b.corpNm || "",
        brandNm: b.brandNm || "",
        indutyLclasNm: cls,
        indutyMlsfcNm: nm,
        frcsCnt: Number(b.frcsCnt) || 0,
        is_service: cls.includes("서비스") ? 1 : 0,
        is_retail: cls.includes("도소매") ? 1 : 0,
        avrgFrcsAmt_천원: costs.frcs,
        avrgFntnAmt_천원: costs.fntn,
        avrgJngEtcAmt_천원: costs.etc,
        smtnAmt_천원: costs.smtn,
        avrgSlsAmt_천원: target, // 타겟 변수
      });
    }

    const csv = toCSV(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="franchise_training_data_2022.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
