import type { Metadata } from 'next'
import CourierBookClient from './CourierBookClient'

export const metadata: Metadata = {
  title: 'Vero Courier · Lilongwe',
  description:
    'Book same-day parcel delivery in Lilongwe as a guest. Pay with Airtel Money, TNM Mpamba, or bank transfer.',
}

export default function CourierPage() {
  return <CourierBookClient />
}
