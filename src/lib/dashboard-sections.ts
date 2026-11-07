import type { VeroIconName } from '@/app/components/landing/icons'
import { isMarketingKpiDemoAvailable } from '@/lib/marketing-tasks'

export type DashboardSectionId =
  | 'vero-ride'
  | 'vero-courier'
  | 'food'
  | 'jobs'
  | 'tenders'
  | 'stay'
  | 'car-hire'
  | 'promotion'
  | 'homepage-ads'
  | 'marketplace-promotions'
  | 'digital-services'
  | 'marketing'
  | 'latest-arrivals'
  | 'announcements'
  | 'home-crawl'
  | 'sell-banners'
  | 'push'
  | 'important-files'
  | 'marketplace'
  | 'orders'
  | 'refunds'
  | 'merchant-reports'
  | 'users'
  | 'kyc'
  | 'agents'
  | 'admins'
  | 'finance'
  | 'bank-transfers'
  | 'wallet'
  | 'rewards'
  | 'verochat'
  | 'get-started'
  | 'analytics'
  | 'settings'
  | 'audit'

export type DashboardSection = {
  id: DashboardSectionId
  title: string
  desc: string
  icon: VeroIconName
  color: string
  bg: string
  superAdminOnly?: boolean
}

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    id: 'vero-ride',
    title: 'Vero Ride',
    desc: 'Drivers, trips, payments, and fleet operations',
    icon: 'car',
    color: '#F97316',
    bg: '#FFF7ED',
  },
  {
    id: 'vero-courier',
    title: 'Vero Courier',
    desc: 'Deliveries, parcels, and couriers',
    icon: 'truck',
    color: '#EA580C',
    bg: '#FFEDD5',
  },
  {
    id: 'food',
    title: 'Food',
    desc: 'Orders, restaurants, and menus',
    icon: 'food',
    color: '#DC2626',
    bg: '#FEF2F2',
  },
  {
    id: 'jobs',
    title: 'Jobs',
    desc: 'Post, edit, and manage job listings',
    icon: 'briefcase',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    id: 'tenders',
    title: 'Tenders',
    desc: 'Malawi procurement notices and RFQs',
    icon: 'file-text',
    color: '#0F766E',
    bg: '#F0FDFA',
  },
  {
    id: 'stay',
    title: 'Stay',
    desc: 'Listings, hosts, and guest bookings',
    icon: 'bed',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    id: 'car-hire',
    title: 'Car Hire',
    desc: 'Operators, listings, commission, and provider leads',
    icon: 'car',
    color: '#0F766E',
    bg: '#F0FDFA',
  },
  {
    id: 'promotion',
    title: 'Promotion',
    desc: 'Campaigns, ads, and offers',
    icon: 'megaphone',
    color: '#DB2777',
    bg: '#FDF2F8',
  },
  {
    id: 'homepage-ads',
    title: 'Homepage ads',
    desc: 'Slider ads, owners, schedule, and platform fees',
    icon: 'megaphone',
    color: '#EA580C',
    bg: '#FFF7ED',
  },
  {
    id: 'marketplace-promotions',
    title: 'Promoted ads',
    desc: 'Marketplace top boosts and Facebook ad orders',
    icon: 'megaphone',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
  {
    id: 'digital-services',
    title: 'Digital services',
    desc: 'Subscriptions, gift cards, and platform revenue',
    icon: 'sparkles',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    desc: 'Tasks, KPIs, and campaign progress',
    icon: 'megaphone',
    color: '#C2410C',
    bg: '#FFF7ED',
  },
  {
    id: 'analytics',
    title: 'Growth',
    desc: 'Visits, downloads, MAU, campaigns, and app performance',
    icon: 'layers',
    color: '#0369A1',
    bg: '#F0F9FF',
  },
  {
    id: 'latest-arrivals',
    title: 'Latest arrivals',
    desc: 'Goods posted in the last 24 hours',
    icon: 'sparkles',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    id: 'announcements',
    title: 'Announcements',
    desc: 'Homepage news with photo and post date',
    icon: 'bell',
    color: '#C2410C',
    bg: '#FFF7ED',
  },
  {
    id: 'home-crawl',
    title: 'Home crawl ticker',
    desc: 'Scrolling messages under the app home search bar',
    icon: 'megaphone',
    color: '#EA580C',
    bg: '#FFF7ED',
  },
  {
    id: 'sell-banners',
    title: 'Sell banners',
    desc: 'Homepage banners that invite people to start selling',
    icon: 'shop',
    color: '#C2410C',
    bg: '#FFF7ED',
  },
  {
    id: 'push',
    title: 'Push notification',
    desc: 'Vero360 Team chat messages and pushes to everyone',
    icon: 'bell',
    color: '#EA580C',
    bg: '#FFF7ED',
  },
  {
    id: 'important-files',
    title: 'Important files',
    desc: 'Folders for key documents: name, usage, and uploads',
    icon: 'file-text',
    color: '#0369A1',
    bg: '#F0F9FF',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    desc: 'Browse, filter, and remove catalog listings',
    icon: 'cart',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    id: 'orders',
    title: 'Orders',
    desc: 'Marketplace orders and fulfillment',
    icon: 'package',
    color: '#0369A1',
    bg: '#F0F9FF',
  },
  {
    id: 'refunds',
    title: 'Refunds',
    desc: 'Review and complete marketplace refunds',
    icon: 'refund',
    color: '#BE123C',
    bg: '#FFF1F2',
  },
  {
    id: 'merchant-reports',
    title: 'Merchant reports',
    desc: 'Review user reports about merchants',
    icon: 'flag',
    color: '#C2410C',
    bg: '#FFF7ED',
  },
  {
    id: 'users',
    title: 'Users',
    desc: 'Customers, merchants, and accounts',
    icon: 'users',
    color: '#0F766E',
    bg: '#F0FDFA',
  },
  {
    id: 'kyc',
    title: 'KYC',
    desc: 'Didit identity checks, reviews, and verification status',
    icon: 'shield',
    color: '#C2410C',
    bg: '#FFF7ED',
  },
  {
    id: 'agents',
    title: 'Agents',
    desc: 'Field agents, onboarding, and registrations',
    icon: 'briefcase',
    color: '#047857',
    bg: '#ECFDF5',
  },
  {
    id: 'audit',
    title: 'Audit trail',
    desc: 'Who changed accounts, content, and payments',
    icon: 'shield',
    color: '#6D28D9',
    bg: '#F5F3FF',
    superAdminOnly: true,
  },
  {
    id: 'admins',
    title: 'Admins',
    desc: 'Super admins and panel admins',
    icon: 'shield',
    color: '#6D28D9',
    bg: '#F5F3FF',
    superAdminOnly: true,
  },
  {
    id: 'finance',
    title: 'Finance (PawaPay)',
    desc: 'PawaPay wallets, escrow, and merchant cash-outs',
    icon: 'wallet',
    color: '#15803D',
    bg: '#F0FDF4',
  },
  {
    id: 'bank-transfers',
    title: 'Bank transfers',
    desc: 'National Bank slips, confirmations, and amounts — separate from PawaPay',
    icon: 'wallet',
    color: '#B45309',
    bg: '#FFFBEB',
  },
  {
    id: 'wallet',
    title: 'Platform wallet',
    desc: 'Commission collected from every Vero360 service',
    icon: 'wallet',
    color: '#0F766E',
    bg: '#F0FDFA',
    superAdminOnly: true,
  },
  {
    id: 'rewards',
    title: 'Vero Coins',
    desc: '1 coin = MWK 50 · cash out from MWK 1,000 · jackpot MWK 5,000',
    icon: 'sparkles',
    color: '#D97706',
    bg: '#FFFBEB',
    superAdminOnly: true,
  },
  {
    id: 'verochat',
    title: 'Help Center',
    desc: 'Live chats from Vero360 Help Center',
    icon: 'headset',
    color: '#EA580C',
    bg: '#FFF7ED',
  },
  {
    id: 'get-started',
    title: 'Get started videos',
    desc: 'Customer, merchant, and driver tutorials',
    icon: 'video',
    color: '#1D4ED8',
    bg: '#EFF6FF',
  },
]

export const DASHBOARD_SECTION_MAP = Object.fromEntries(
  DASHBOARD_SECTIONS.map(s => [s.id, s]),
) as Record<DashboardSectionId, DashboardSection>

export type DashboardNavBadgeKey =
  | 'help'
  | 'courier'
  | 'drivers'
  | 'rides'
  | 'orders'
  | 'food'
  | 'users'
  | 'reports'
  | 'digital'
  | 'homepageAds'
  | 'stay'
  | 'promotions'
  | 'carHire'
  | 'carHireListings'
  | 'carHireLeads'
  | 'bankTransfers'

export type DashboardNavItem = {
  href: string
  label: string
  icon: VeroIconName
  badgeKey?: DashboardNavBadgeKey
  superAdminOnly?: boolean
  /** Visible to marketers (otherwise marketers only see Marketing tasks + My progress + settings). */
  marketerAllowed?: boolean
  /** Hidden from full admins — marketer-only nav item. */
  marketerOnly?: boolean
  /** Visible to field agents. */
  agentAllowed?: boolean
  /** Hidden from full admins — agent-only nav item. */
  agentOnly?: boolean
}

export type DashboardNavSubgroup = {
  id: string
  title: string
  items: DashboardNavItem[]
}

export type DashboardNavGroup = {
  id: string
  title: string
  /** Direct links at this group level. */
  items?: DashboardNavItem[]
  /** Nested collapsible subgroups (e.g. Ride under Services). */
  subgroups?: DashboardNavSubgroup[]
}

/** Flatten every link under a nav group (items + subgroup items). */
export function flattenNavGroupItems(group: DashboardNavGroup): DashboardNavItem[] {
  return [
    ...(group.items ?? []),
    ...(group.subgroups ?? []).flatMap(sub => sub.items),
  ]
}

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  {
    id: 'home',
    title: 'Home',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
      {
        href: '/dashboard/agent',
        label: 'Agent portal',
        icon: 'briefcase',
        agentAllowed: true,
        agentOnly: true,
      },
      {
        href: '/dashboard/agent/onboard',
        label: 'Onboard user',
        icon: 'user',
        agentAllowed: true,
        agentOnly: true,
      },
      {
        href: '/dashboard/agent/registrations',
        label: 'My registrations',
        icon: 'users',
        agentAllowed: true,
        agentOnly: true,
      },
      {
        href: '/dashboard/agent/drivers',
        label: 'Verify drivers',
        icon: 'car',
        agentAllowed: true,
        agentOnly: true,
        badgeKey: 'drivers',
      },
    ],
  },
  {
    id: 'growth',
    title: 'Growth',
    items: [
      {
        href: '/dashboard/analytics',
        label: 'Analytics',
        icon: 'layers',
        marketerAllowed: true,
      },
      {
        href: '/dashboard/marketing/campaigns',
        label: 'Campaigns',
        icon: 'megaphone',
        marketerAllowed: true,
      },
      { href: '/dashboard/marketing/tasks', label: 'Marketing tasks', icon: 'megaphone', marketerAllowed: true },
      {
        href: '/dashboard/marketing/progress',
        label: 'My progress',
        icon: 'layers',
        marketerAllowed: true,
        marketerOnly: true,
      },
      {
        href: '/dashboard/marketing/kpi',
        label: isMarketingKpiDemoAvailable() ? 'Demo KPI' : 'My KPI',
        icon: 'layers',
        marketerAllowed: true,
        marketerOnly: true,
      },
      { href: '/dashboard/marketing/kpi', label: 'Marketing KPI', icon: 'layers' },
    ],
  },
  {
    id: 'services',
    title: 'Services',
    subgroups: [
      {
        id: 'ride',
        title: 'Vero Ride',
        items: [
          { href: '/dashboard/vero-ride', label: 'Drivers', icon: 'car', badgeKey: 'drivers' },
          { href: '/dashboard/vero-ride/trips', label: 'Trips', icon: 'car', badgeKey: 'rides' },
          { href: '/dashboard/vero-ride/live', label: 'Live map', icon: 'car' },
          { href: '/dashboard/vero-ride/sos', label: 'SOS', icon: 'car' },
        ],
      },
      {
        id: 'courier',
        title: 'Courier & food',
        items: [
          { href: '/dashboard/vero-courier', label: 'Vero Courier', icon: 'truck', badgeKey: 'courier' },
          { href: '/dashboard/food', label: 'Food', icon: 'food', badgeKey: 'food' },
        ],
      },
      {
        id: 'marketplace',
        title: 'Marketplace & orders',
        items: [
          { href: '/dashboard/marketplace', label: 'Marketplace', icon: 'cart' },
          { href: '/dashboard/orders', label: 'Orders', icon: 'package', badgeKey: 'orders' },
          { href: '/dashboard/refunds', label: 'Refunds', icon: 'refund' },
          { href: '/dashboard/merchant-reports', label: 'Merchant reports', icon: 'flag', badgeKey: 'reports' },
        ],
      },
      {
        id: 'stay-hire',
        title: 'Stay & car hire',
        items: [
          { href: '/dashboard/stay', label: 'Stay', icon: 'bed', badgeKey: 'stay' },
          { href: '/dashboard/car-hire', label: 'Car Hire', icon: 'car', badgeKey: 'carHire' },
          { href: '/dashboard/car-hire/listings', label: 'Listings', icon: 'car', badgeKey: 'carHireListings' },
          { href: '/dashboard/car-hire/leads', label: 'Leads', icon: 'briefcase', badgeKey: 'carHireLeads' },
        ],
      },
      {
        id: 'jobs-digital',
        title: 'Jobs & digital',
        items: [
          { href: '/dashboard/jobs', label: 'Jobs', icon: 'briefcase' },
          { href: '/dashboard/tenders', label: 'Tenders', icon: 'file-text' },
          { href: '/dashboard/digital-services', label: 'Digital services', icon: 'sparkles', badgeKey: 'digital' },
        ],
      },
    ],
  },
  {
    id: 'acquire',
    title: 'Acquire & engage',
    items: [
      { href: '/dashboard/promotion', label: 'Promotion', icon: 'megaphone' },
      { href: '/dashboard/homepage-ads', label: 'Homepage ads', icon: 'megaphone', badgeKey: 'homepageAds' },
      { href: '/dashboard/marketplace-promotions', label: 'Promoted ads', icon: 'megaphone', badgeKey: 'promotions' },
      { href: '/dashboard/latest-arrivals', label: 'Latest arrivals', icon: 'sparkles' },
      { href: '/dashboard/announcements', label: 'Announcements', icon: 'bell' },
      { href: '/dashboard/home-crawl', label: 'Home crawl', icon: 'megaphone' },
      { href: '/dashboard/sell-banners', label: 'Sell banners', icon: 'shop' },
      { href: '/dashboard/push', label: 'Push notification', icon: 'bell' },
    ],
  },
  {
    id: 'people',
    title: 'People',
    items: [
      { href: '/dashboard/users', label: 'Users', icon: 'users', badgeKey: 'users' },
      { href: '/dashboard/kyc', label: 'KYC', icon: 'shield' },
      { href: '/dashboard/agents', label: 'Agents', icon: 'briefcase' },
      { href: '/dashboard/agents/registrations', label: 'Agent registrations', icon: 'users' },
      { href: '/dashboard/admins', label: 'Admins', icon: 'shield', superAdminOnly: true },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    items: [
      { href: '/dashboard/bank-transfers', label: 'Bank transfers', icon: 'wallet', badgeKey: 'bankTransfers' },
      { href: '/dashboard/finance', label: 'Finance (PawaPay)', icon: 'wallet' },
      { href: '/dashboard/wallet', label: 'Platform wallet', icon: 'wallet', superAdminOnly: true },
      {
        href: '/dashboard/rewards',
        label: 'Vero Coins',
        icon: 'sparkles',
        superAdminOnly: true,
      },
    ],
  },
  {
    id: 'support',
    title: 'Support & content',
    items: [
      { href: '/dashboard/verochat', label: 'Help Center', icon: 'headset', badgeKey: 'help' },
      { href: '/dashboard/get-started', label: 'Get started videos', icon: 'video' },
      { href: '/dashboard/important-files', label: 'Important files', icon: 'file-text' },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      { href: '/dashboard/audit', label: 'Audit trail', icon: 'shield', superAdminOnly: true },
      {
        href: '/dashboard/settings',
        label: 'Settings',
        icon: 'settings',
        marketerAllowed: true,
        agentAllowed: true,
      },
    ],
  },
]

export function getDashboardSection(id: string) {
  const section = DASHBOARD_SECTION_MAP[id as DashboardSectionId]
  if (section) return section

  if (id === 'settings') {
    return {
      id: 'settings' as const,
      title: 'Settings',
      desc: 'Panel preferences and account settings.',
      icon: 'settings' as const,
      color: '#475569',
      bg: '#F8FAFC',
    }
  }

  if (id === 'marketing-kpi' || id === 'marketing-tasks') {
    return {
      id: 'marketing' as const,
      title: id === 'marketing-kpi' ? 'Marketing KPI' : 'Marketing tasks',
      desc:
        id === 'marketing-kpi'
          ? 'See how every marketer is performing.'
          : 'Assign and track marketer content tasks.',
      icon: id === 'marketing-kpi' ? ('layers' as const) : ('megaphone' as const),
      color: '#C2410C',
      bg: '#FFF7ED',
    }
  }

  return null
}
