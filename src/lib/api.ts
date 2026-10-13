export type ApiError = Error & { status?: number; code?: string; response?: { data?: unknown } }

type JsonRecord = Record<string, unknown>

let csrfToken = ''

export function setCsrfToken(token: string) {
  csrfToken = token
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<{ data: T }> {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (init.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method.toUpperCase()) && csrfToken) {
    headers.set('x-csrf-token', csrfToken)
  }
  const response = await fetch(path, { ...init, headers, credentials: 'include' })
  const data = await response.json().catch(() => ({})) as JsonRecord
  if (!response.ok) {
    const error = Object.assign(new Error(String(data.error || 'Request failed')), {
      status: response.status,
      code: typeof data.code === 'string' ? data.code : undefined,
      response: { data },
    }) as ApiError
    throw error
  }
  return { data: data as T }
}

export const api = {
  get<T = any>(path: string) {
    return request<T>(path)
  },
  post<T = any>(path: string, body: JsonRecord = {}) {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  },
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
