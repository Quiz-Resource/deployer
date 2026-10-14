import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown> & { id?: string }

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!url || !key) throw new Error('Supabase server credentials are not configured.')

const client: SupabaseClient = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function assertOk(error: { message?: string } | null): void {
  if (error) throw new Error(`Supabase persistence error: ${error.message ?? 'unknown error'}`)
}

export const supabaseDb = {
  async list<T extends Row>(table: string, options: { limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000)
    const { data, error } = await client.from(table).select('*').limit(limit)
    assertOk(error)
    return { items: (data ?? []) as T[] }
  },

  async get<T extends Row>(table: string, ids: string[]) {
    if (!ids.length) return [] as T[]
    const { data, error } = await client.from(table).select('*').in('id', ids)
    assertOk(error)
    const rows = (data ?? []) as T[]
    return ids.map(id => rows.find(row => row.id === id)).filter(Boolean) as T[]
  },

  async add(table: string, records: Row[]) {
    if (!records.length) return [] as string[]
    const { data, error } = await client.from(table).insert(records).select('id')
    assertOk(error)
    return (data ?? []).map(row => String(row.id))
  },

  async update(table: string, records: Array<{ id: string; record: Row }>) {
    const results: boolean[] = []
    for (const { id, record } of records) {
      const { data, error } = await client.from(table).update(record).eq('id', id).select('id')
      assertOk(error)
      results.push(Boolean(data?.length))
    }
    return results
  },

  async delete(table: string, ids: string[]) {
    if (!ids.length) return [] as boolean[]
    const { data, error } = await client.from(table).delete().in('id', ids).select('id')
    assertOk(error)
    return ids.map(id => Boolean(data?.some(row => String(row.id) === id)))
  },
}

export async function checkSupabaseHealth() {
  const { error } = await client.from('users').select('id').limit(1)
  if (error) throw new Error(`Supabase health check failed: ${error.message}`)
  return true
}
