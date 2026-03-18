import { NextResponse } from "next/server";
import {
  fitOLS,
  predictOLS,
  rmse,
  kFoldCV,
  fitScaler,
  applyScaler,
  addBias,
} from "@/app/lib/regression";

const BRANDS_URL =
  "https://apis.data.go.kr/1130000/FftcBrandFrcsStatsService/getBrandFrcsStats";

const COST_ENDPOINTS: Record<string, string> = {
  외식: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnOutStats",
  서비스: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnSrvcStats",
  도소매: "https://apis.data.go.kr/1130000/FftcSclasIndutyFntnStatsService/getSclaIndutyFntnWhrtStats",
};

const FEATURE_NAMES = [
  "절편(intercept)",
  "가맹점수(frcsCnt)",
  "업종_서비스(is_service)",
  "업종_도소매(is_retail)",
  "평균가맹비(avrgFrcsAmt)",
  "평균보증금(avrgFntnAmt)",
  "기타창업비(avrgJngEtcAmt)",
];

export async function GET() {
  const key = process.env.FTC_API_KEY;
  if (!key)
    return NextResponse.json({ error: "FTC_API_KEY not set" }, { status: 500 });

  try {
    // 1. 브랜드 데이터 수집 (page1 + page2)
    const [b1, b2, c외식, c서비스, c도소매] = await Promise.all([
      fetch(`${BRANDS_URL}?serviceKey=${key}&pageNo=1&numOfRows=5000&yr=2022&resultType=json`).then((r) => r.json()),
      fetch(`${BRANDS_URL}?serviceKey=${key}&pageNo=2&numOfRows=5000&yr=2022&resultType=json`).then((r) => r.json()),
      fetch(`${COST_ENDPOINTS["외식"]}?serviceKey=${key}&pageNo=1&numOfRows=200&yr=2022&resultType=json`).then((r) => r.json()),
      fetch(`${COST_ENDPOINTS["서비스"]}?serviceKey=${key}&pageNo=1&numOfRows=200&yr=2022&resultType=json`).then((r) => r.json()),
      fetch(`${COST_ENDPOINTS["도소매"]}?serviceKey=${key}&pageNo=1&numOfRows=200&yr=2022&resultType=json`).then((r) => r.json()),
    ]);

    const brands: any[] = [
      ...(b1.items || []),
      ...(b2.items || []),
    ];

    // 2. 업종별 창업비용 맵 (indutyMlsfcNm → costs)
    const costMap = new Map<string, { frcs: number; fntn: number; etc: number }>();
    for (const raw of [c외식, c서비스, c도소매]) {
      for (const item of raw.items || []) {
        const nm = item.indutyMlsfcNm?.trim();
        if (!nm) continue;
        costMap.set(nm, {
          frcs: Number(item.avrgFrcsAmt) || 0,
          fntn: Number(item.avrgFntnAmt) || 0,
          etc: Number(item.avrgJngEtcAmt) || 0,
        });
      }
    }

    // 3. 피처 행렬 구성
    //    Target : avrgSlsAmt (연평균매출, 천원)
    //    Features: frcsCnt, is_service, is_retail, avrgFrcsAmt, avrgFntnAmt, avrgJngEtcAmt
    const X: number[][] = [];
    const y: number[] = [];

    for (const b of brands) {
      const target = Number(b.avrgSlsAmt);
      if (!target || target <= 0) continue;

      const cls = b.indutyLclasNm || "";
      const nm = b.indutyMlsfcNm?.trim() || "";
      const costs = costMap.get(nm) ?? { frcs: 0, fntn: 0, etc: 0 };

      X.push([
        Number(b.frcsCnt) || 0,
        cls.includes("서비스") ? 1 : 0,
        cls.includes("도소매") ? 1 : 0,
        costs.frcs,
        costs.fntn,
        costs.etc,
      ]);
      y.push(target);
    }

    if (X.length < 50)
      return NextResponse.json(
        { error: `유효 데이터 부족: ${X.length}건` },
        { status: 400 }
      );

    const n = X.length;

    // 4. 80/20 분할 (셔플 후 앞 80% train, 뒤 20% test)
    const shuffled = Array.from({ length: n }, (_, i) => i).sort(
      () => Math.random() - 0.5
    );
    const splitAt = Math.floor(n * 0.8);
    const trainIdx = shuffled.slice(0, splitAt);
    const testIdx = shuffled.slice(splitAt);

    const trainX = trainIdx.map((i) => X[i]);
    const trainY = trainIdx.map((i) => y[i]);
    const testX = testIdx.map((i) => X[i]);
    const testY = testIdx.map((i) => y[i]);

    // 5. K-Fold CV (k=5, training set에서만)
    const cv = kFoldCV(trainX, trainY, 5);

    // 6. 전체 train set으로 최종 모델 학습
    const { means, stds } = fitScaler(trainX);
    const trainXb = addBias(applyScaler(trainX, means, stds));
    const testXb = addBias(applyScaler(testX, means, stds));

    const theta = fitOLS(trainXb, trainY);
    const testPreds = predictOLS(testXb, theta);
    const testRMSE = rmse(testY, testPreds);

    // 7. 계수를 원본 스케일로 역변환하여 해석 가능하게 표현
    //    실제 계수 = theta[j+1] / stds[j]  (표준화된 계수는 그대로 사용)
    const coefficients = FEATURE_NAMES.map((name, i) => ({
      feature: name,
      // theta[0] = intercept, theta[1..] = 표준화 계수
      coefStandardized: i === 0 ? theta[0] : theta[i],
    })).sort((a, b) => Math.abs(b.coefStandardized) - Math.abs(a.coefStandardized));

    return NextResponse.json({
      dataCount: { total: n, train: trainIdx.length, test: testIdx.length },
      crossValidation: {
        k: 5,
        foldRMSEs: cv.foldRMSEs.map((v) => Math.round(v)),
        meanRMSE: Math.round(cv.meanRMSE),
        stdRMSE: Math.round(cv.stdRMSE),
      },
      testRMSE: Math.round(testRMSE),
      model: {
        type: "Multiple Linear Regression (OLS)",
        features: FEATURE_NAMES.slice(1), // intercept 제외
        target: "avrgSlsAmt (연평균매출, 천원)",
        preprocessing: "Z-score 표준화 (train 기준)",
        coefficients,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
