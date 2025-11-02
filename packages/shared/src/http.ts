export type HeaderMap = Record<string, string>;

export function buildCorsHeaders(origin: string | null | undefined, allowedOrigins: string[], extra: HeaderMap = {}): HeaderMap {
  const o = origin ?? '';
  const selected = allowedOrigins.includes(o) ? o : allowedOrigins[0] ?? '*';
  return {
    'access-control-allow-origin': selected,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type',
    ...extra
  };
}

export function buildPreflightHeaders(origin: string | null | undefined, allowedOrigins: string[], methods: string[]): HeaderMap {
  return buildCorsHeaders(origin, allowedOrigins, {
    'access-control-allow-methods': methods.join(', ')
  });
}


