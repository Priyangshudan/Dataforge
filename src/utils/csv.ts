import fs from 'fs';
import crypto from 'crypto';
import { parse } from 'csv-parse';

export interface ExtractedColumnMetadata {
  column_name: string;
  data_type: 'INTEGER' | 'NUMERIC' | 'BOOLEAN' | 'TIMESTAMP' | 'TEXT';
  is_nullable: boolean;
  ordinal_position: number;
  null_count: number;
  distinct_count: number;
  sample_values: any[];
}

export interface ExtractedCsvResult {
  file_size_bytes: number;
  checksum_sha256: string;
  row_count: number;
  column_count: number;
  columns: ExtractedColumnMetadata[];
  schema_fingerprint: string;
}

/**
 * Infer the primitive data type from sampled string values
 */
function inferDataType(values: string[]): 'INTEGER' | 'NUMERIC' | 'BOOLEAN' | 'TIMESTAMP' | 'TEXT' {
  if (values.length === 0) return 'TEXT';

  const nonNull = values.filter((v) => v !== '' && v !== null && v !== undefined);
  if (nonNull.length === 0) return 'TEXT';

  const isBoolean = nonNull.every((v) => {
    const lower = v.toLowerCase().trim();
    return lower === 'true' || lower === 'false' || lower === '1' || lower === '0' || lower === 't' || lower === 'f';
  });
  if (isBoolean) return 'BOOLEAN';

  const isInteger = nonNull.every((v) => /^-?\d+$/.test(v.trim()));
  if (isInteger) return 'INTEGER';

  const isNumeric = nonNull.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim()));
  if (isNumeric) return 'NUMERIC';

  const isDate = nonNull.every((v) => {
    if (v.trim().length < 8) return false;
    const parsed = Date.parse(v);
    return !isNaN(parsed);
  });
  if (isDate) return 'TIMESTAMP';

  return 'TEXT';
}

/**
 * Streamingly parse CSV and compute byte checksum, row count, and column profile
 */
export async function analyzeCsvFile(filePath: string): Promise<ExtractedCsvResult> {
  const stat = await fs.promises.stat(filePath);
  const file_size_bytes = stat.size;

  // 1. Calculate SHA-256 byte checksum directly from file stream
  const hash = crypto.createHash('sha256');
  const fileStream = fs.createReadStream(filePath);
  for await (const chunk of fileStream) {
    hash.update(chunk);
  }
  const checksum_sha256 = hash.digest('hex');

  // 2. Parse CSV stream for structure and column statistics
  return new Promise((resolve, reject) => {
    let row_count = 0;
    let headers: string[] = [];
    const columnValues: Map<string, string[]> = new Map();
    const nullCounts: Map<string, number> = new Map();
    const distinctSets: Map<string, Set<string>> = new Map();

    const parser = parse({
      delimiter: ',',
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    fs.createReadStream(filePath)
      .pipe(parser)
      .on('data', (row: string[]) => {
        if (headers.length === 0) {
          headers = row.map((h, idx) => (h && h.trim().length > 0 ? h.trim() : `col_${idx + 1}`));
          for (const h of headers) {
            columnValues.set(h, []);
            nullCounts.set(h, 0);
            distinctSets.set(h, new Set());
          }
          return;
        }

        row_count++;
        for (let i = 0; i < headers.length; i++) {
          const colName = headers[i];
          const val = row[i] !== undefined ? row[i].trim() : '';

          if (val === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'nan') {
            nullCounts.set(colName, (nullCounts.get(colName) || 0) + 1);
          } else {
            distinctSets.get(colName)?.add(val);
          }

          // Sample first 50 values for type inference and sample_values
          const samples = columnValues.get(colName);
          if (samples && samples.length < 50 && val !== '') {
            samples.push(val);
          }
        }
      })
      .on('end', () => {
        const columns: ExtractedColumnMetadata[] = headers.map((colName, idx) => {
          const samples = columnValues.get(colName) || [];
          const nullCount = nullCounts.get(colName) || 0;
          const distinctSet = distinctSets.get(colName) || new Set();
          const dataType = inferDataType(samples);

          return {
            column_name: colName,
            data_type: dataType,
            is_nullable: nullCount > 0,
            ordinal_position: idx + 1,
            null_count: nullCount,
            distinct_count: distinctSet.size,
            sample_values: samples.slice(0, 5),
          };
        });

        // Compute schema fingerprint (MD5 hash of ordered colName:dataType)
        const schemaString = columns.map((c) => `${c.column_name}:${c.data_type}`).join('|');
        const schema_fingerprint = crypto.createHash('md5').update(schemaString).digest('hex');

        resolve({
          file_size_bytes,
          checksum_sha256,
          row_count,
          column_count: headers.length,
          columns,
          schema_fingerprint,
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

