export interface WorkLog {
  id: string;
  user_id: string;
  clock_in: string; // ISO timestamp
  clock_out: string | null; // ISO timestamp
  duration_minutes: number;
  overtime_amount: number;
  created_at: string;
  clock_in_lat?: number;
  clock_in_lng?: number;
  clock_in_postcode?: string;
  clock_out_lat?: number;
  clock_out_lng?: number;
  clock_out_postcode?: string;
  
  // New fields for detailed activity view
  check_in_location?: string; // Full location string where work started
  check_out_location?: string; // Full location string where work ended
  is_outstation?: boolean; // Boolean to trigger RM 30 meal allowance
  day_type?: DayType; // Weekday, Weekend, or PublicHoliday
}

export interface OTSummary {
  totalAmount: number;
  totalHours: number;
}

export type DayType = 'weekday' | 'weekend' | 'public_holiday';

export interface OTCalculationBreakdown {
  duration: number; // Total minutes worked
  dayType: DayType;
  
  // Weekday breakdown
  fixedOTHours: number; // First 10 hours (weekdays) - counted but not paid
  fixedOTMinutes: number;
  
  // OT breakdown by rate
  otHours1x: number; // Weekend first 6 hours at 1.0x
  otHours1_5x: number; // Weekday after 10h, Weekend after 6h at 1.5x
  otHours2x: number; // Public holiday first 9 hours at 2.0x
  otHours3x: number; // Public holiday after 9 hours at 3.0x
  
  otMinutes1x: number;
  otMinutes1_5x: number;
  otMinutes2x: number;
  otMinutes3x: number;
  
  // Amounts (rounded to 30-minute blocks)
  otAmount1x: number;
  otAmount1_5x: number;
  otAmount2x: number;
  otAmount3x: number;
  
  // Allowances
  mealAllowance: number; // RM 30 for outstation overnight
  
  // Totals
  totalOTAmount: number;
  totalAmount: number; // Including all allowances
}
