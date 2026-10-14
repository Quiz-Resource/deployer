import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
const supabaseUrl = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

let client: SupabaseClient | undefined

export function getSupabaseClient() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured for this environment.')
  client ??= createClient(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}

export async function uploadAvatar(file: File, userId: string) {
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MB.')
  }
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${userId}/avatar-${crypto.randomUUID()}.${extension}`
  const { error } = await getSupabaseClient().storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  })
  if (error) throw error
  const { data } = getSupabaseClient().storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function removeAvatar(path: string) {
  if (!path) return
  const marker = '/storage/v1/object/public/avatars/'
  const index = path.indexOf(marker)
  if (index >= 0) await getSupabaseClient().storage.from('avatars').remove([path.slice(index + marker.length)])
}

export type SupabaseTables = {
  profiles: { id: string; workspace_id: string; name: string; role: string; active: boolean; avatar_url: string | null }
  products: { id: string; workspace_id: string; name: string; sku: string; price: number; cost: number; stock: number; version: number }
  sales: { id: string; workspace_id: string; number: string; total: number; idempotency_key: string }
  receipts: { id: string; workspace_id: string; sale_id: string; receipt_number: string }
}

export { supabaseUrl }
