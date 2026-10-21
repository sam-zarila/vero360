import type { Metadata } from 'next'
import BookingDetailClient from './BookingDetailClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Booking details · Vero360 car-hire provider',
  description:
    'Handover inspections, incidents, extensions, and support for a single Vero360 car-hire booking.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProviderBookingDetailPage({ params }: Props) {
  const { id } = await params
  return <BookingDetailClient bookingId={id} />
}
