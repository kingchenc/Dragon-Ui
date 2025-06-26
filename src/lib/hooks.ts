import { formatTime, formatDateTime, formatDate } from './utils';

// Simplified hooks - no more settings needed, store.ts handles everything
export function useTimeFormatting() {
  return {
    formatTime: (date: string | Date) => 
      formatTime(date),
    
    formatDateTime: (date: string | Date) => 
      formatDateTime(date),
    
    formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) => 
      formatDate(date, 'auto', options),
    
    timeFormat: '24h',
    timezone: 'auto'
  };
}