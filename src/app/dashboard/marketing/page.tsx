import { redirect } from 'next/navigation'

/** Hub redirects to campaigns — growth entry for marketers. */
export default function MarketingHubPage() {
  redirect('/dashboard/marketing/campaigns')
}
