export interface ParsedError {
  message: string;
  stack?: string[];
  sqlQuery?: string;
  code?: string;
  details?: Record<string, any>;
}

/**
 * Parse error from response body
 */
export function parseError(bodyPreview: any): ParsedError | null {
  if (!bodyPreview) return null;

  try {
    const body = typeof bodyPreview === 'string' ? JSON.parse(bodyPreview) : bodyPreview;
    
    const error: ParsedError = {
      message: body.error || body.message || body.error_description || body.detail || 'Unknown error',
      code: body.code || body.error_code || body.statusCode,
      details: {},
    };

    // Parse stack trace
    if (body.stack) {
      error.stack = body.stack
        .split('\n')
        .filter((line: string) => line.trim())
        .slice(0, 10); // First 10 lines
    } else if (typeof bodyPreview === 'string' && bodyPreview.includes('    at ')) {
      error.stack = bodyPreview
        .split('\n')
        .filter(line => line.trim().startsWith('at '))
        .slice(0, 10);
    }

    // Detect SQL queries (common ORM patterns)
    if (body.sql || body.query) {
      error.sqlQuery = body.sql || body.query;
    } else if (typeof bodyPreview === 'string') {
      const sqlMatch = bodyPreview.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+[^;]+/i);
      if (sqlMatch) {
        error.sqlQuery = sqlMatch[0];
      }
    }

    // Extract additional details
    const ignoredKeys = ['error', 'message', 'stack', 'sql', 'query', 'statusCode', 'code'];
    Object.entries(body).forEach(([key, value]) => {
      if (!ignoredKeys.includes(key) && value) {
        error.details![key] = value;
      }
    });

    return error;
  } catch (e) {
    // If parsing fails, return raw body as message
    if (typeof bodyPreview === 'string') {
      return {
        message: bodyPreview.slice(0, 200),
      };
    }
    return null;
  }
}

/**
 * Format stack trace for display with syntax highlighting
 */
export function formatStackTrace(stack: string[]): string {
  return stack
    .map(line => {
      // Highlight file paths and line numbers
      return line
        .replace(/\((.*?):(\d+):(\d+)\)/, '<span class="text-blue-300">($1</span>:<span class="text-yellow-300">$2</span>:<span class="text-yellow-300">$3</span>)')
        .replace(/at\s+([^\s]+)/, 'at <span class="text-purple-300">$1</span>');
    })
    .join('\n');
}

/**
 * Format SQL query with basic syntax highlighting
 */
export function formatSQL(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
    'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX',
  ];

  let formatted = sql;

  // Highlight keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, match => 
      `<span class="text-cyan-300 font-semibold">${match}</span>`
    );
  });

  // Highlight strings
  formatted = formatted.replace(/'([^']*)'/g, '<span class="text-green-300">\'$1\'</span>');
  formatted = formatted.replace(/"([^"]*)"/g, '<span class="text-green-300">"$1"</span>');

  // Highlight numbers
  formatted = formatted.replace(/\b(\d+)\b/g, '<span class="text-yellow-300">$1</span>');

  // Highlight table/column names (basic heuristic)
  formatted = formatted.replace(/`([^`]+)`/g, '<span class="text-blue-300">`$1`</span>');

  return formatted;
}

/**
 * Detect error type from status code and message
 */
export function getErrorType(status: number, message: string): {
  type: string;
  color: string;
  icon: string;
} {
  const lower = message.toLowerCase();

  if (status === 404) {
    return { type: 'Not Found', color: 'yellow', icon: '🔍' };
  } else if (status === 401 || status === 403) {
    return { type: 'Auth Error', color: 'orange', icon: '🔒' };
  } else if (status === 400) {
    return { type: 'Bad Request', color: 'yellow', icon: '⚠️' };
  } else if (status === 429) {
    return { type: 'Rate Limited', color: 'purple', icon: '⏱️' };
  } else if (status === 500) {
    return { type: 'Server Error', color: 'red', icon: '💥' };
  } else if (status === 502 || status === 503 || status === 504) {
    return { type: 'Service Down', color: 'red', icon: '🚫' };
  } else if (lower.includes('timeout')) {
    return { type: 'Timeout', color: 'orange', icon: '⏰' };
  } else if (lower.includes('database') || lower.includes('sql')) {
    return { type: 'Database Error', color: 'red', icon: '🗄️' };
  } else if (lower.includes('connection')) {
    return { type: 'Connection Error', color: 'red', icon: '🔌' };
  } else if (status >= 500) {
    return { type: 'Server Error', color: 'red', icon: '❌' };
  } else if (status >= 400) {
    return { type: 'Client Error', color: 'yellow', icon: '⚠️' };
  }

  return { type: 'Error', color: 'gray', icon: '⚠️' };
}

