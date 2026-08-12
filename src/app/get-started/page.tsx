import { Suspense } from 'react'
import GetStartedClient from './GetStartedClient'
import { getGetStartedVideosMap } from '@/lib/get-started-videos-admin'

export const dynamic = 'force-dynamic'

export default async function GetStartedPage() {
  const videos = await getGetStartedVideosMap()
  return (
    <Suspense>
      <GetStartedClient videos={videos} />
    </Suspense>
  )
}
