import { PremiumGuard } from '@/components/subscription/premium-guard'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PremiumGuard>{children}</PremiumGuard>
}
