import { useParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { EvidenceProvider } from './evidence'

/** Supplies the EvidenceProvider with the current route's patientId. */
export function EvidenceRouteProvider({ children }: { children: ReactNode }) {
  const { patientId = '' } = useParams()
  return <EvidenceProvider patientId={patientId}>{children}</EvidenceProvider>
}
