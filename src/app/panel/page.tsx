import type { Metadata } from 'next'
import PanelSignIn from './PanelSignIn'


export const metadata: Metadata = {
  title: 'Sign in — Vero360',
  description: 'Sign in to your Vero360 account.',
}

export default function PanelPage() {
  return <PanelSignIn />
}
