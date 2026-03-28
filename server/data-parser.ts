import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedDataset {
  rows: any[];
  columns: {
    name: string;
    type: 'number' | 'string' | 'date' | 'boolean';
    sampleValues?: any[];
    uniqueCount?: number;
    nullCount?: number;
  }[];
  rowCount: number;
  columnCount: number;
  previewData: any[];
}

/**
 * Parse CSV file buffer
 */
export async function parseCSV(buffer: Buffer): Promise<ParsedDataset> {
  return new Promise((resolve, reject) => {
    const text = buffer.toString('utf-8');
    
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as any[];
          if (!rows || rows.length === 0) {
            throw new Error('ملف CSV فارغ');
          }

          const dataset = analyzeDataset(rows);
          resolve(dataset);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: any) => {
        reject(new Error(`فشل تحليل CSV: ${error.message}`));
      }
    });
  });
}

/**
 * Parse Excel file buffer
 */
export async function parseExcel(buffer: Buffer): Promise<ParsedDataset> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('ملف Excel لا يحتوي على أوراق');
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      defval: null 
    });

    if (!rows || rows.length === 0) {
      throw new Error('ورقة Excel فارغة');
    }

    const dataset = analyzeDataset(rows);
    return dataset;
  } catch (error: any) {
    throw new Error(`فشل تحليل Excel: ${error.message}`);
  }
}

/**
 * Parse JSON file buffer
 */
export async function parseJSON(buffer: Buffer): Promise<ParsedDataset> {
  try {
    const text = buffer.toString('utf-8');
    const data = JSON.parse(text);

    // Handle both array and single object
    const rows = Array.isArray(data) ? data : [data];
    
    if (!rows || rows.length === 0) {
      throw new Error('ملف JSON فارغ');
    }

    const dataset = analyzeDataset(rows);
    return dataset;
  } catch (error: any) {
    throw new Error(`فشل تحليل JSON: ${error.message}`);
  }
}

/**
 * Analyze dataset and infer column types
 */
function analyzeDataset(rows: any[]): ParsedDataset {
  if (!rows || rows.length === 0) {
    throw new Error('البيانات فارغة');
  }

  // Get column names from first row
  const firstRow = rows[0];
  const columnNames = Object.keys(firstRow);

  if (columnNames.length === 0) {
    throw new Error('لا توجد أعمدة في البيانات');
  }

  // Analyze each column
  const columns = columnNames.map(name => {
    const values = rows.map(row => row[name]).filter(v => v !== null && v !== undefined && v !== '');
    const sampleValues = values.slice(0, 10);
    const uniqueValues = new Set(values);
    const nullCount = rows.length - values.length;

    // Infer type
    let type: 'number' | 'string' | 'date' | 'boolean' = 'string';
    
    if (values.length > 0) {
      const firstValue = values[0];
      
      // Check if boolean
      if (typeof firstValue === 'boolean' || 
          (typeof firstValue === 'string' && ['true', 'false', 'yes', 'no', 'نعم', 'لا'].includes(firstValue.toLowerCase()))) {
        type = 'boolean';
      }
      // Check if number
      else if (typeof firstValue === 'number' || !isNaN(Number(firstValue))) {
        type = 'number';
      }
      // Check if date
      else if (isValidDate(firstValue)) {
        type = 'date';
      }
    }

    return {
      name,
      type,
      sampleValues,
      uniqueCount: uniqueValues.size,
      nullCount
    };
  });

  // Get preview data (first 10 rows)
  const previewData = rows.slice(0, 10);

  return {
    rows,
    columns,
    rowCount: rows.length,
    columnCount: columns.length,
    previewData
  };
}

/**
 * Check if value is a valid date
 */
function isValidDate(value: any): boolean {
  if (!value) return false;
  
  const date = new Date(value);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Calculate basic statistics for numeric columns
 */
export function calculateStatistics(rows: any[], columnName: string) {
  const values = rows
    .map(row => row[columnName])
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(v => Number(v))
    .filter(v => !isNaN(v));

  if (values.length === 0) {
    return null;
  }

  values.sort((a, b) => a - b);

  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  const median = values[Math.floor(values.length / 2)];
  const min = values[0];
  const max = values[values.length - 1];
  
  // Standard deviation
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    count: values.length,
    mean: Number(mean.toFixed(2)),
    median,
    min,
    max,
    stdDev: Number(stdDev.toFixed(2))
  };
}

/**
 * Get top values for categorical columns
 */
export function getTopValues(rows: any[], columnName: string, limit: number = 10) {
  const valueCounts = new Map<any, number>();
  
  rows.forEach(row => {
    const value = row[columnName];
    if (value !== null && value !== undefined && value !== '') {
      valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
    }
  });

  const sorted = Array.from(valueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const total = rows.length;
  
  return sorted.map(([value, count]) => ({
    value,
    count,
    percentage: Number(((count / total) * 100).toFixed(2))
  }));
}
