import { createClient } from '@/lib/supabase/client'
import type { FiscalConfig } from '@/types'

export async function getFiscalConfig(userId: string): Promise<FiscalConfig | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fiscal_config')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as FiscalConfig
}
