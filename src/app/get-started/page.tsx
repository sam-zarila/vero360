import { Suspense } from 'react'
import GetStartedClient from './GetStartedClient'

export default function GetStartedPage() {
  return (
    <Suspense>
      <GetStartedClient />
    </Suspense>
  )
}
