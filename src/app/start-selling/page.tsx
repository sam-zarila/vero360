import { redirect } from 'next/navigation'

/** Legacy /start-selling → Marketplace guide (one service per page). */
export default function StartSellingIndexPage() {
  redirect('/start-selling/marketplace')
}
