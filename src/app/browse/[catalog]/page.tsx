import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BrowseCatalogClient from './BrowseCatalogClient'
import { BROWSE_CATALOGS, isBrowseCatalogId } from '@/lib/catalog-cards'

type Props = { params: Promise<{ catalog: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { catalog } = await params
  if (!isBrowseCatalogId(catalog)) return { title: 'Browse · Vero360' }
  const meta = BROWSE_CATALOGS[catalog]
  return {
    title: `${meta.title} · Vero360`,
    description: meta.subtitle,
  }
}

export default async function BrowseCatalogPage({ params }: Props) {
  const { catalog } = await params
  if (!isBrowseCatalogId(catalog)) notFound()
  return <BrowseCatalogClient catalog={catalog} />
}
