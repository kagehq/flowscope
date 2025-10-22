const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'set-cookie',
];

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'access_token',
  'id_token',
  'authorization',
];

export function redactHeaders(headers: Record<string, any>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    output[key] = SENSITIVE_HEADERS.includes(key.toLowerCase())
      ? '***redacted***'
      : String(value);
  }
  return output;
}

export function redactJson(obj: any): any {
  if (obj && typeof obj === 'object') {
    const output: any = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      output[key] = SENSITIVE_KEYS.includes(key) ? '***redacted***' : redactJson(value);
    }
    return output;
  }
  return obj;
}

