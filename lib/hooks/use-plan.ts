'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isPremiumFiscal, type Assinatura } from '@/lib/supabase/assinatura'

interface PlanState {
  loading: boolean
  isPremium: boolean
  assinatura: Assinatura | null
}

export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>({ loading: true, isPremium: false, assinatura: null })

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) { setState({ loading: false, isPremium: false, assinatura: null }); return }
      const { data: ass } = await createClient()
        .from('assinaturas')
        .select('*')
        .eq('user_id', data.user.id)
        .single()
      const assinatura = ass as Assinatura | null
      setState({ loading: false, isPremium: isPremiumFiscal(assinatura), assinatura })
    })
  }, [])

  return state
}
