'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isPro, isPremium, type Assinatura, type PlanoAssinatura } from '@/lib/supabase/assinatura'

interface PlanState {
  loading: boolean
  isPro: boolean
  isPremium: boolean
  plano: PlanoAssinatura | null
  assinatura: Assinatura | null
}

const INITIAL_STATE: PlanState = {
  loading: true,
  isPro: false,
  isPremium: false,
  plano: null,
  assinatura: null,
}

export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>(INITIAL_STATE)

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setState({ ...INITIAL_STATE, loading: false })
        return
      }
      const { data: ass } = await createClient()
        .from('assinaturas')
        .select('*')
        .eq('user_id', data.user.id)
        .single()
      const assinatura = ass as Assinatura | null
      setState({
        loading: false,
        isPro: isPro(assinatura),
        isPremium: isPremium(assinatura),
        plano: assinatura?.plano ?? null,
        assinatura,
      })
    })
  }, [])

  return state
}
