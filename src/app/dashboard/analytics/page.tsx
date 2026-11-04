import { redirect } from 'next/navigation'

/** Website analytics lives in the marketing portal for admins and marketers. */
export default function AnalyticsRedirectPage() {
  redirect('/dashboard/marketing/website')
}
