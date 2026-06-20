import type { Metadata } from 'next'
import PitchDeckClient from './PitchDeckClient'

export const metadata: Metadata = {
  title: 'Rotahr — Pitch Deck',
  description: 'One app to run your entire venue. Rotas, Clock-In, Reservations, Bookkeeping, Payroll — all in one place. Built for Irish hospitality.',
  openGraph: {
    title: 'Rotahr — One app to run your entire venue',
    description: 'See how Rotahr replaces 4–5 separate tools for Irish hospitality venues.',
    images: ['https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FCrgxhP2MJXbx87efI2p01%2Fslide-01.png'],
  },
  twitter: { card: 'summary_large_image' },
}

export default function PitchDeckPage() {
  return <PitchDeckClient />
}
