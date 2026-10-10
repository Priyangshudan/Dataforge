import fs from 'fs';
import { parse } from 'csv-parse';

export interface ColumnDriftDetail {
  column_name: string;
  data_type: string;
  base_mean?: number;
  comp_mean?: number;
  mean_shift?: number;
  relative_shift?: number;
  drift_detected: boolean;
}

export interface DriftAnalysisResult {
  similarity_score: number;
  drift_score: number;
  comparison_method: string;
  column_overlap_count: number;
  schema_match_ratio: number;
  shared_columns: string[];
  details: {
    base_rows: number;
    comp_rows: number;
    row_count_diff: number;
    added_columns: string[];
    removed_columns: string[];
    column_drift: ColumnDriftDetail[];
    drift_status: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  };
}

/**
 * Calculates schema Jaccard index: |A ∩ B| / |A ∪ B|
 */
export function calculateJaccardSimilarity(setA: string[], setB: string[]): {
  score: number;
  shared: string[];
  added: string[];
  removed: string[];
} {
  const a = new Set(setA.map((s) => s.toLowerCase()));
  const b = new Set(setB.map((s) => s.toLowerCase()));

  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);

  const score = union.size === 0 ? 1.0 : intersection.size / union.size;
  const shared = [...intersection];
  const added = [...b].filter((x) => !a.has(x));
  const removed = [...a].filter((x) => !b.has(x));

  return { score: Number(score.toFixed(4)), shared, added, removed };
}

/**
 * Reads a CSV file and calculates summary statistics (mean, count) for numeric columns
 */
async function computeNumericStats(
  filePath: string,
  numericColumns: string[]
): Promise<{ rowCount: number; means: Map<string, number> }> {
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    const sums = new Map<string, number>();
    const counts = new Map<string, number>();
    let colIndices: { name: string; idx: number }[] = [];

    const parser = parse({ delimiter: ',', trim: true, skip_empty_lines: true });

    fs.createReadStream(filePath)
      .pipe(parser)
      .on('data', (row: string[]) => {
        if (colIndices.length === 0) {
          colIndices = row
            .map((name, idx) => ({ name: name.trim().toLowerCase(), idx }))
            .filter((c) => numericColumns.map((n) => n.toLowerCase()).includes(c.name));
          colIndices.forEach((c) => {
            sums.set(c.name, 0);
            counts.set(c.name, 0);
          });
          return;
        }

        rowCount++;
        for (const col of colIndices) {
          const raw = row[col.idx];
          if (raw !== undefined && raw !== '' && !isNaN(Number(raw))) {
            const num = Number(raw);
            sums.set(col.name, (sums.get(col.name) || 0) + num);
            counts.set(col.name, (counts.get(col.name) || 0) + 1);
          }
        }
      })
      .on('end', () => {
        const means = new Map<string, number>();
        for (const [col, sum] of sums.entries()) {
          const count = counts.get(col) || 0;
          means.set(col, count > 0 ? sum / count : 0);
        }
        resolve({ rowCount, means });
      })
      .on('error', (err) => reject(err));
  });
}

/**
 * Performs full drift and similarity analysis between two dataset version files and column sets
 */
export async function computeDatasetDrift(
  basePath: string,
  compPath: string,
  baseColumns: { column_name: string; data_type: string }[],
  compColumns: { column_name: string; data_type: string }[]
): Promise<DriftAnalysisResult> {
  const baseColNames = baseColumns.map((c) => c.column_name);
  const compColNames = compColumns.map((c) => c.column_name);

  // 1. Structural schema comparison via Jaccard
  const { score: jaccardScore, shared, added, removed } = calculateJaccardSimilarity(
    baseColNames,
    compColNames
  );

  // 2. Identify shared numeric columns for statistical drift computation
  const sharedNumeric = baseColumns
    .filter(
      (bc) =>
        (bc.data_type === 'NUMERIC' || bc.data_type === 'INTEGER') &&
        compColumns.some(
          (cc) =>
            cc.column_name.toLowerCase() === bc.column_name.toLowerCase() &&
            (cc.data_type === 'NUMERIC' || cc.data_type === 'INTEGER')
        )
    )
    .map((c) => c.column_name);

  const columnDrift: ColumnDriftDetail[] = [];
  let totalRelativeShift = 0;
  let baseRows = 0;
  let compRows = 0;

  if (fs.existsSync(basePath) && fs.existsSync(compPath) && sharedNumeric.length > 0) {
    const baseStats = await computeNumericStats(basePath, sharedNumeric);
    const compStats = await computeNumericStats(compPath, sharedNumeric);
    baseRows = baseStats.rowCount;
    compRows = compStats.rowCount;

    for (const col of sharedNumeric) {
      const lower = col.toLowerCase();
      const bMean = baseStats.means.get(lower) || 0;
      const cMean = compStats.means.get(lower) || 0;
      const shift = Math.abs(cMean - bMean);
      const relative = bMean !== 0 ? shift / Math.abs(bMean) : shift > 0 ? 1.0 : 0.0;

      totalRelativeShift += relative;
      columnDrift.push({
        column_name: col,
        data_type: 'NUMERIC',
        base_mean: Number(bMean.toFixed(4)),
        comp_mean: Number(cMean.toFixed(4)),
        mean_shift: Number(shift.toFixed(4)),
        relative_shift: Number(relative.toFixed(4)),
        drift_detected: relative > 0.15,
      });
    }
  }

  // Calculate composite drift score
  const avgShift = sharedNumeric.length > 0 ? totalRelativeShift / sharedNumeric.length : 0.0;
  // Drift score bounded between 0 and 1
  const driftScore = Number((1 - Math.exp(-avgShift)).toFixed(4));

  let driftStatus: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' = 'NONE';
  if (driftScore > 0.4) driftStatus = 'HIGH';
  else if (driftScore > 0.2) driftStatus = 'MODERATE';
  else if (driftScore > 0.05) driftStatus = 'LOW';

  return {
    similarity_score: jaccardScore,
    drift_score: driftScore,
    comparison_method: 'STATISTICAL_DISTRIBUTION_DRIFT',
    column_overlap_count: shared.length,
    schema_match_ratio: jaccardScore,
    shared_columns: shared,
    details: {
      base_rows: baseRows,
      comp_rows: compRows,
      row_count_diff: compRows - baseRows,
      added_columns: added,
      removed_columns: removed,
      column_drift: columnDrift,
      drift_status: driftStatus,
    },
  };
}

