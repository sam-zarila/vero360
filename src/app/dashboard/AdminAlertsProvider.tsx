'use client'

import { createContext, useContext } from 'react'
import { useCourierAlerts, type CourierAlertState } from '@/lib/courier-alerts'
import { useDriverAlerts, type DriverAlertState } from '@/lib/driver-alerts'
import { useRideAlerts, type RideAlertState } from '@/lib/ride-alerts'
import { useHelpCenterUnread } from '@/lib/help-center-alerts'
import { useMerchantReportAlerts, type MerchantReportAlertState } from '@/lib/merchant-report-alerts'
import { useOrderAlerts, type OrderAlertState } from '@/lib/order-alerts'
import { useFoodAlerts, type FoodAlertState } from '@/lib/food-alerts'
import { usePaymentAlerts, type PaymentAlertState } from '@/lib/payment-alerts'
import { useStayAlerts, type StayAlertState } from '@/lib/stay-alerts'
import { useUserAlerts, type UserAlertState } from '@/lib/user-alerts'
import { useCarHireAlerts, type CarHireAlertState } from '@/lib/car-hire-alerts'
import type { DashboardNavBadgeKey } from '@/lib/dashboard-sections'

type AdminAlertsContextValue = {
  courier: CourierAlertState
  drivers: DriverAlertState
  rides: RideAlertState
  orders: OrderAlertState
  food: FoodAlertState
  stay: StayAlertState
  users: UserAlertState
  merchantReports: MerchantReportAlertState
  payments: PaymentAlertState
  carHire: CarHireAlertState
  helpUnread: number
}

const AdminAlertsContext = createContext<AdminAlertsContextValue | null>(null)

export function AdminAlertsProvider({ children }: { children: React.ReactNode }) {
  const courier = useCourierAlerts()
  const drivers = useDriverAlerts()
  const rides = useRideAlerts()
  const orders = useOrderAlerts()
  const food = useFoodAlerts()
  const stay = useStayAlerts()
  const users = useUserAlerts()
  const merchantReports = useMerchantReportAlerts()
  const payments = usePaymentAlerts()
  const carHire = useCarHireAlerts()
  const helpUnread = useHelpCenterUnread()
  return (
    <AdminAlertsContext.Provider
      value={{
        courier,
        drivers,
        rides,
        orders,
        food,
        stay,
        users,
        merchantReports,
        payments,
        carHire,
        helpUnread,
      }}
    >
      {children}
    </AdminAlertsContext.Provider>
  )
}

export function useAdminAlerts() {
  const ctx = useContext(AdminAlertsContext)
  if (!ctx) {
    throw new Error('useAdminAlerts must be used within AdminAlertsProvider')
  }
  return ctx
}

export function useNavBadgeCounts(): Record<DashboardNavBadgeKey, number> {
  const ctx = useContext(AdminAlertsContext)
  return {
    help: ctx?.helpUnread ?? 0,
    courier: ctx?.courier.pending ?? 0,
    drivers: ctx?.drivers.pending ?? 0,
    rides: (ctx?.rides.issues ?? 0) + (ctx?.rides.unseen ?? 0),
    orders: ctx?.orders.pending ?? 0,
    food: ctx?.food.pending ?? 0,
    users: ctx?.users.newCount ?? 0,
    reports: ctx?.merchantReports.open ?? 0,
    digital: ctx?.payments.digitalNew ?? 0,
    homepageAds: ctx?.payments.homepageAdNew ?? 0,
    stay: ctx?.stay.pending ?? 0,
    promotions: ctx?.payments.promoNew ?? 0,
    carHire: ctx?.carHire.companies ?? 0,
    carHireListings: ctx?.carHire.listings ?? 0,
    carHireLeads: ctx?.carHire.leads ?? 0,
    bankTransfers: ctx?.payments.bankNew ?? 0,
  }
}

/** Safe for optional use outside provider (returns zeros). */
export function useCourierPendingBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.courier.pending ?? 0
}

export function useDriverPendingBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.drivers.pending ?? 0
}

export function useRideIssuesBadge() {
  const ctx = useContext(AdminAlertsContext)
  return (ctx?.rides.issues ?? 0) + (ctx?.rides.unseen ?? 0)
}

export function useOrdersPendingBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.orders.pending ?? 0
}

export function useFoodPendingBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.food.pending ?? 0
}

export function useStayPendingBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.stay.pending ?? 0
}

export function useMarkOrdersSeen() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.orders.markOrdersSeen
}

export function useMarkFoodSeen() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.food.markFoodSeen
}

export function useMarkRidesSeen() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.rides.markRidesSeen
}

export function useNewUsersBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.users.newCount ?? 0
}

export function useMerchantReportsOpenBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.merchantReports.open ?? 0
}

export function useHelpCenterUnreadBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.helpUnread ?? 0
}

export function useDigitalPaymentsNewBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.payments.digitalNew ?? 0
}

export function useHomepageAdPaymentsNewBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.payments.homepageAdNew ?? 0
}

export function usePromoPaymentsNewBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.payments.promoNew ?? 0
}

export function useBankTransfersNewBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.payments.bankNew ?? 0
}

export function useCarHireCompaniesBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.carHire.companies ?? 0
}

export function useCarHireListingsBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.carHire.listings ?? 0
}

export function useCarHireLeadsBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.carHire.leads ?? 0
}
