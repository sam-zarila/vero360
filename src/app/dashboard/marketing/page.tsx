import { redirect } from 'next/navigation'

/** Hub redirects to Marketing tasks — main service entry. */
export default function MarketingHubPage() {
  redirect('/dashboard/marketing/tasks')
}
