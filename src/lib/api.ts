export type ApiError = Error & { status?: number; code?: string; response?: { data?: unknown } }

type JsonRecord = Record<string, unknown>

let csrfToken = ''
const REQUEST_TIMEOUT_MS = 20_000
const RETRYABLE_STATUS = new Set([408, 425, 429, 502, 503, 504])

export function setCsrfToken(token: string) {
  csrfToken = token
}

function requestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<{ data: T }> {
  const method = (init.method || 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  headers.set('x-request-id', requestId())
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('x-csrf-token', csrfToken)

  let attempt = 0
  while (true) {
    const controller = new AbortController()
    const signal = init.signal || controller.signal
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(path, { ...init, method, headers, credentials: 'include', signal })
      const data = await response.json().catch(() => ({})) as JsonRecord
      if (!response.ok) {
        const error = Object.assign(new Error(String(data.error || 'Request failed')), {
          status: response.status,
          code: typeof data.code === 'string' ? data.code : undefined,
          response: { data },
        }) as ApiError
        if (method === 'GET' && RETRYABLE_STATUS.has(response.status) && attempt < 2) {
          attempt += 1
          await new Promise(resolve => window.setTimeout(resolve, 250 * 2 ** attempt))
          continue
        }
        throw error
      }
      return { data: data as T }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('The request timed out. Please try again.')
      if (method === 'GET' && attempt < 2 && !(error as ApiError)?.status) {
        attempt += 1
        await new Promise(resolve => window.setTimeout(resolve, 250 * 2 ** attempt))
        continue
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  }
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
