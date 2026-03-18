# 🏪 프랜차이즈 창업 수익 분석기

> 공정거래위원회 공공 API 기반 프랜차이즈 창업 수익 시뮬레이터 + 머신러닝 예측 모델

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Recharts](https://img.shields.io/badge/Recharts-3-22d3ee)](https://recharts.org)

---

## 📌 프로젝트 개요

소상공인·예비 창업자가 **브랜드 + 지역**을 선택하면 예상 월매출, 순이익, 창업비용 회수 기간을 즉시 확인할 수 있는 웹 애플리케이션입니다.
추가로 **OLS 다중선형회귀 모델**을 자체 구현해 업종별 매출 예측력을 검증합니다.

---

## ✨ 주요 기능

### 1. 수익 시뮬레이터
- 브랜드 검색 (10,000+ 브랜드 실시간 검색)
- 17개 시·도 지역 선택
- 고용 인원 입력 → 2026년 최저시급 기반 인건비 자동 계산
- 업종별(외식·서비스·도소매) 고정비 비율 적용
- 창업 초기비용 구성 파이 차트
- 월별 예상 순이익 및 창업비용 회수 기간 산출

### 2. 회귀 모델 학습 & 검증
- **모델**: OLS 다중선형회귀 (정규방정식 직접 구현, 외부 ML 라이브러리 미사용)
- **데이터**: 공정거래위원회 브랜드별 가맹 통계 (~10,000건)
- **분할**: Train 80% / Test 20%
- **과적합 방지**: 5-Fold Cross Validation
- **평가 지표**: RMSE
- 피처 중요도 시각화 (표준화 계수 기준)
- 과적합 자동 판정 (CV RMSE vs Test RMSE 비교)

### 3. 원천 데이터 CSV 내보내기
- 학습에 사용된 전체 데이터를 CSV로 다운로드
- UTF-8 BOM 포함 (Excel 한글 호환)

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 3 |
| ML | OLS 회귀 (직접 구현 — 행렬 정규방정식) |
| Data | 공정거래위원회 가맹사업정보 공공 API |

---

## 📁 프로젝트 구조

```
franchise-profit-analysis/
├── app/
│   ├── api/franchise/
│   │   ├── brands/          # 브랜드 검색 API
│   │   ├── regional-sales/  # 지역별 평균매출 API
│   │   ├── startup-costs/   # 창업비용 통계 API
│   │   ├── hq-finance/      # 가맹본부 재무현황 API
│   │   ├── model-train/     # 회귀 모델 학습 API
│   │   └── training-data/   # CSV 내보내기 API
│   ├── components/
│   │   ├── Dashboard.tsx    # 수익 시뮬레이터
│   │   ├── ModelAnalysis.tsx# 모델 학습 & 결과 시각화
│   │   └── BrandSearch.tsx  # 브랜드 검색 컴포넌트
│   ├── lib/
│   │   └── regression.ts    # OLS, K-Fold CV, RMSE 구현
│   └── page.tsx             # 탭 기반 라우팅
├── public/
└── ...
```

---

## ⚙️ 로컬 실행

### 1. 저장소 클론

```bash
git clone https://github.com/Kernelist/franchise-profit-analysis.git
cd franchise-profit-analysis
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일에 공정거래위원회 API 키 입력:

```env
FTC_API_KEY=your_api_key_here
```

> API 키 발급: [공공데이터포털](https://www.data.go.kr) → "공정거래위원회 가맹사업정보" 검색

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

---

## 🤖 ML 모델 상세

외부 라이브러리 없이 TypeScript로 직접 구현한 선형 회귀 모듈입니다.

### 정규방정식 (Normal Equation)
```
θ = (XᵀX)⁻¹Xᵀy
```

### 피처 (6개)
| 피처 | 설명 |
|------|------|
| frcsCnt | 가맹점 수 |
| is_service | 서비스업 더미 |
| is_retail | 도소매업 더미 |
| avrgFrcsAmt | 평균 가맹비 (천원) |
| avrgFntnAmt | 평균 보증금 (천원) |
| avrgJngEtcAmt | 기타 창업비 (천원) |

### 타겟
- `avrgSlsAmt` — 브랜드별 연평균매출액 (천원)

### 검증 파이프라인
```
전체 데이터 (~10K)
    ↓ Shuffle
  80% Train → 5-Fold CV → 평균 RMSE ± std
  20% Test  → 최종 RMSE
    ↓
  과적합 판정 (|Test RMSE - CV RMSE| / CV RMSE < 15%)
```

---

## 📊 데이터 출처

- **공정거래위원회** 가맹사업정보 제공시스템 (2022년 기준)
  - 브랜드별 가맹점 현황 (`FftcBrandFrcsStatsService`)
  - 지역별 업종 평균매출 (`FftcAreaIndutyAvrStatsService`)
  - 업종별 창업비용 통계 (`FftcSclasIndutyFntnStatsService`)
  - 가맹본부 재무현황 (`FftcjnghdqrtrsFnnrInfo2_Service`)

---

## 📄 라이선스

MIT License
