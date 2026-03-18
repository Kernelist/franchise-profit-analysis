import { NextRequest, NextResponse } from "next/server";

const FIN_BASE = "https://apis.data.go.kr/1130000/FftcjnghdqrtrsFnnrInfo2_Service/getjnghdqrtrsFnlttinfo";
const GNL_BASE = "https://apis.data.go.kr/1130000/FftcJnghdqrtrsGnrlDtl2_Service/getjnghdqrtrsGnlinfo";

const parseRange = (val: string): number => {
  if (!val || val === "0") return 0;
  const parts = val.split("~").map((v) => parseInt(v.replace(/,/g, ""), 10));
  if (parts.length === 1) return parts[0];
  return Math.round((parts[0] + parts[1]) / 2);
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yr = searchParams.get("yr") || "2022";
  const mnno = searchParams.get("mnno") || "";

  const key = process.env.FTC_API_KEY;
  if (!key) return NextResponse.json({ error: "FTC_API_KEY not set" }, { status: 500 });
  if (!mnno) return NextResponse.json({ error: "mnno is required" }, { status: 400 });

  try {
    const [finRes, gnlRes] = await Promise.all([
      fetch(`${FIN_BASE}?serviceKey=${key}&pageNo=1&numOfRows=5&jngBizCrtraYr=${yr}&jnghdqrtrsMnno=${mnno}&resultType=json`),
      fetch(`${GNL_BASE}?serviceKey=${key}&pageNo=1&numOfRows=1&jngBizCrtraYr=${yr}&jnghdqrtrsMnno=${mnno}&resultType=json`),
    ]);

    const finData = await finRes.json();
    const gnlData = await gnlRes.json();

    const finance = finData.items?.[0];
    const general = gnlData.items?.[0];

    if (!finance) return NextResponse.json({ error: "재무정보 없음" }, { status: 404 });

    return NextResponse.json({
      mnno,
      corpNm: general?.jnghdqrtrsConmNm || "",
      acntgYr: finance.acntgYr,
      salesAmt: parseRange(finance.slsAmtScopeVal),
      operatingProfit: parseRange(finance.bsnProfitAmtScopeVal),
      netProfit: parseRange(finance.thstrmNtpfAmtScopeVal),
      assets: parseRange(finance.assetsAmtScopeVal),
      debt: parseRange(finance.debtAmtScopeVal),
      capital: parseRange(finance.caplAmtScopeVal),
      rawRanges: {
        sales: finance.slsAmtScopeVal,
        operatingProfit: finance.bsnProfitAmtScopeVal,
        netProfit: finance.thstrmNtpfAmtScopeVal,
      },
      entScaleNm: general?.entScaleNm,
      brandCnt: general?.brandCnt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
