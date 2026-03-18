// ── Matrix utilities ──────────────────────────────────────────────────────────

function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

function matMul(A: number[][], B: number[][]): number[][] {
  const R = A.length, C = B[0].length, K = B.length;
  const out: number[][] = Array.from({ length: R }, () => new Array(C).fill(0));
  for (let i = 0; i < R; i++)
    for (let k = 0; k < K; k++)
      if (A[i][k] !== 0)
        for (let j = 0; j < C; j++) out[i][j] += A[i][k] * B[k][j];
  return out;
}

function inverse(A: number[][]): number[][] {
  const n = A.length;
  const aug = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const p = aug[col][col];
    if (Math.abs(p) < 1e-12) throw new Error(`Singular matrix at col ${col}`);
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

// ── OLS: θ = (XᵀX)⁻¹Xᵀy  (X must include bias column) ────────────────────

export function fitOLS(X: number[][], y: number[]): number[] {
  const Xt = transpose(X);
  const theta = matMul(
    matMul(inverse(matMul(Xt, X)), Xt),
    y.map((v) => [v])
  );
  return theta.map((r) => r[0]);
}

export function predictOLS(X: number[][], theta: number[]): number[] {
  return X.map((row) => row.reduce((s, xi, i) => s + xi * theta[i], 0));
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export function rmse(actual: number[], pred: number[]): number {
  return Math.sqrt(
    actual.reduce((s, y, i) => s + (y - pred[i]) ** 2, 0) / actual.length
  );
}

// ── Scaler (z-score on training set, applied to test) ─────────────────────

export function fitScaler(X: number[][]): { means: number[]; stds: number[] } {
  const n = X.length, p = X[0].length;
  const means = Array.from({ length: p }, (_, j) =>
    X.reduce((s, r) => s + r[j], 0) / n
  );
  const stds = Array.from({ length: p }, (_, j) => {
    const v = X.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / n;
    return Math.sqrt(v) || 1;
  });
  return { means, stds };
}

export function applyScaler(
  X: number[][],
  means: number[],
  stds: number[]
): number[][] {
  return X.map((row) => row.map((xi, j) => (xi - means[j]) / stds[j]));
}

export function addBias(X: number[][]): number[][] {
  return X.map((row) => [1, ...row]);
}

// ── Fisher-Yates shuffle ──────────────────────────────────────────────────────

function shuffleIndices(n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

// ── K-Fold Cross Validation ───────────────────────────────────────────────────

export interface CVResult {
  foldRMSEs: number[];
  meanRMSE: number;
  stdRMSE: number;
}

export function kFoldCV(X: number[][], y: number[], k: number): CVResult {
  const n = X.length;
  const idx = shuffleIndices(n);
  const foldSize = Math.floor(n / k);
  const foldRMSEs: number[] = [];

  for (let fold = 0; fold < k; fold++) {
    const testIdx = idx.slice(fold * foldSize, (fold + 1) * foldSize);
    const trainIdx = [
      ...idx.slice(0, fold * foldSize),
      ...idx.slice((fold + 1) * foldSize),
    ];

    const trainX = trainIdx.map((i) => X[i]);
    const trainY = trainIdx.map((i) => y[i]);
    const testX = testIdx.map((i) => X[i]);
    const testY = testIdx.map((i) => y[i]);

    const { means, stds } = fitScaler(trainX);
    const trainXb = addBias(applyScaler(trainX, means, stds));
    const testXb = addBias(applyScaler(testX, means, stds));

    const theta = fitOLS(trainXb, trainY);
    foldRMSEs.push(rmse(testY, predictOLS(testXb, theta)));
  }

  const mean = foldRMSEs.reduce((s, v) => s + v, 0) / k;
  const std = Math.sqrt(
    foldRMSEs.reduce((s, v) => s + (v - mean) ** 2, 0) / k
  );
  return { foldRMSEs, meanRMSE: mean, stdRMSE: std };
}
