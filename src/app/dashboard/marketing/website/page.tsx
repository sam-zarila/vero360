import { redirect } from 'next/navigation'

/** Old marketing URL. App and website performance is its own section. */
export default function MarketingWebsiteRedirectPage() {
  redirect('/dashboard/analytics')
}
