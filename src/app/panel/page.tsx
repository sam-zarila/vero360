import type { Metadata } from 'next'
import PanelSignIn from './PanelSignIn'


export const metadata: Metadata = {
  title: 'Admin sign in — Vero360',
  description: 'Sign in to the Vero360 admin dashboard.',
}

export default function PanelPage() {
  return <PanelSignIn />
}
