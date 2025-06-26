/**
 * Billing Cycle Utilities
 * Handles custom billing cycle calculations for monthly usage tracking
 */

export interface BillingPeriod {
  start: Date
  end: Date
  label: string
  key: string
}

/**
 * Get the billing period for a given date
 */
export function getBillingPeriod(date: Date, billingCycleDay: number): BillingPeriod {
  const targetDate = new Date(date)
  const year = targetDate.getFullYear()
  const month = targetDate.getMonth()
  const day = targetDate.getDate()
  
  // Calculate period start
  let periodStart = new Date(year, month, billingCycleDay)
  
  // If we haven't reached this month's billing day yet, use previous month
  if (day < billingCycleDay) {
    periodStart = new Date(year, month - 1, billingCycleDay)
  }
  
  // Handle months with fewer days (e.g., Feb 30th -> Feb 28th)
  if (periodStart.getDate() !== billingCycleDay && billingCycleDay > 28) {
    // Use last day of the month
    periodStart = new Date(year, month - (day < billingCycleDay ? 0 : -1), 0)
  }
  
  // Calculate period end (one day before next cycle starts)
  let periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, billingCycleDay)
  if (periodEnd.getDate() !== billingCycleDay && billingCycleDay > 28) {
    periodEnd = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0)
  }
  periodEnd = new Date(periodEnd.getTime() - 1) // One day before
  
  const formatDate = (date: Date) => date.toISOString().split('T')[0]
  
  return {
    start: periodStart,
    end: periodEnd,
    label: `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    key: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}-${String(billingCycleDay).padStart(2, '0')}`
  }
}

/**
 * Get current billing period
 */
export function getCurrentBillingPeriod(billingCycleDay: number): BillingPeriod {
  return getBillingPeriod(new Date(), billingCycleDay)
}

/**
 * Check if a date falls within a billing period
 */
export function isDateInBillingPeriod(date: Date, period: BillingPeriod): boolean {
  const checkDate = new Date(date)
  return checkDate >= period.start && checkDate <= period.end
}

/**
 * Get billing period key for database grouping (replaces YYYY-MM format)
 */
export function getBillingPeriodKey(date: Date, billingCycleDay: number): string {
  const period = getBillingPeriod(date, billingCycleDay)
  return period.key
}

/**
 * Get all billing periods within a date range
 */
export function getBillingPeriodsInRange(startDate: Date, endDate: Date, billingCycleDay: number): BillingPeriod[] {
  const periods: BillingPeriod[] = []
  let currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    const period = getBillingPeriod(currentDate, billingCycleDay)
    
    // Avoid duplicates
    if (!periods.find(p => p.key === period.key)) {
      periods.push(period)
    }
    
    // Move to next month
    currentDate = new Date(period.end.getTime() + 24 * 60 * 60 * 1000) // Next day after period end
  }
  
  return periods.sort((a, b) => b.start.getTime() - a.start.getTime()) // Most recent first
}

/**
 * Convert calendar month format (YYYY-MM) to billing period format
 */
export function convertCalendarMonthToBillingPeriod(calendarMonth: string, billingCycleDay: number): BillingPeriod {
  const [year, month] = calendarMonth.split('-').map(Number)
  const firstDayOfMonth = new Date(year, month - 1, 1)
  return getBillingPeriod(firstDayOfMonth, billingCycleDay)
}

/**
 * Get SQL condition for billing period filtering
 */
export function getBillingPeriodSQLCondition(billingCycleDay: number, periodCount: number = 12): string {
  const periods = getBillingPeriodsInRange(
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    new Date(),
    billingCycleDay
  ).slice(0, periodCount)
  
  if (periods.length === 0) return "1=0" // No valid periods
  
  const conditions = periods.map(period => 
    `(timestamp >= '${period.start.toISOString()}' AND timestamp <= '${period.end.toISOString()}')`
  ).join(' OR ')
  
  return `(${conditions})`
}

/**
 * Format billing period for display
 */
export function formatBillingPeriod(period: BillingPeriod): string {
  return period.label
}

/**
 * Check if today is within X days of billing cycle reset
 */
export function isDaysUntilBillingReset(billingCycleDay: number, warningDays: number = 3): { isNear: boolean, daysUntil: number } {
  const currentPeriod = getCurrentBillingPeriod(billingCycleDay)
  const today = new Date()
  const nextPeriodStart = new Date(currentPeriod.end.getTime() + 24 * 60 * 60 * 1000)
  
  const daysUntil = Math.ceil((nextPeriodStart.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  
  return {
    isNear: daysUntil <= warningDays,
    daysUntil
  }
}