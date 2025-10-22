export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffResult {
  key: string;
  type: DiffType;
  leftValue?: any;
  rightValue?: any;
}

export function compareObjects(left: any, right: any): DiffResult[] {
  const results: DiffResult[] = [];
  const allKeys = new Set([
    ...Object.keys(left || {}),
    ...Object.keys(right || {}),
  ]);

  allKeys.forEach((key) => {
    const leftVal = left?.[key];
    const rightVal = right?.[key];

    if (leftVal === undefined && rightVal !== undefined) {
      results.push({ key, type: 'added', rightValue: rightVal });
    } else if (leftVal !== undefined && rightVal === undefined) {
      results.push({ key, type: 'removed', leftValue: leftVal });
    } else if (JSON.stringify(leftVal) !== JSON.stringify(rightVal)) {
      results.push({ key, type: 'changed', leftValue: leftVal, rightValue: rightVal });
    } else {
      results.push({ key, type: 'unchanged', leftValue: leftVal, rightValue: rightVal });
    }
  });

  return results;
}

export function formatValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

