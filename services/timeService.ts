import { differenceInMinutes, startOfMonth, endOfMonth, isSaturday, isSunday, format } from 'date-fns';
import { supabase } from '../supabaseClient';
import { WorkLog, OTCalculationBreakdown, DayType } from '../types';

/**
 * Constants
 */
const BASIC_SALARY = 3200;
const WORK_DAYS_PER_MONTH = 26;
const HOURS_PER_DAY = 8;
const BASE_HOURLY_RATE = BASIC_SALARY / WORK_DAYS_PER_MONTH / HOURS_PER_DAY; // RM 15.38/hour

const BLOCK_MINUTES = 30; // Minimum block for OT calculation

// Rate multipliers
const RATE_1X = 1.0;
const RATE_1_5X = 1.5;
const RATE_2X = 2.0;
const RATE_3X = 3.0;

// Thresholds in minutes
const WEEKDAY_FIXED_OT_MINUTES = 600; // 10 hours
const WEEKEND_FIRST_TIER_MINUTES = 360; // 6 hours
const PUBLIC_HOLIDAY_FIRST_TIER_MINUTES = 540; // 9 hours

const MEAL_ALLOWANCE = 30; // RM 30 for outstation overnight

/**
 * List of public holidays (YYYY-MM-DD format)
 * This can be extended or fetched from an API/database
 * For now, using Malaysia public holidays as example
 */
let PUBLIC_HOLIDAYS: string[] = [
  // Add your public holidays here, e.g.:
  // '2024-01-01', // New Year
  // '2024-01-28', // Chinese New Year
  // etc.
];

/**
 * Set the list of public holidays
 * @param holidays Array of dates in YYYY-MM-DD format
 */
export const setPublicHolidays = (holidays: string[]): void => {
  PUBLIC_HOLIDAYS = [...holidays];
};

/**
 * Add public holidays to the existing list
 * @param holidays Array of dates in YYYY-MM-DD format
 */
export const addPublicHolidays = (holidays: string[]): void => {
  PUBLIC_HOLIDAYS = Array.from(new Set([...PUBLIC_HOLIDAYS, ...holidays]));
};

/**
 * Get the current list of public holidays
 * @returns Array of public holiday dates in YYYY-MM-DD format
 */
export const getPublicHolidays = (): string[] => {
  return [...PUBLIC_HOLIDAYS];
};

/**
 * Check if a date is a public holiday
 */
const isPublicHoliday = (date: Date): boolean => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return PUBLIC_HOLIDAYS.includes(dateStr);
};

/**
 * Determine the day type (weekday, weekend, or public holiday)
 * @param date The date to check
 * @param isPublicHolidayOverride Optional override to manually set public holiday status
 */
export const getDayType = (date: Date, isPublicHolidayOverride?: boolean): DayType => {
  // If manually set as public holiday, use that
  if (isPublicHolidayOverride === true) {
    return 'public_holiday';
  }
  
  // Otherwise, auto-detect
  if (isPublicHoliday(date)) {
    return 'public_holiday';
  }
  if (isSaturday(date) || isSunday(date)) {
    return 'weekend';
  }
  return 'weekday';
};

/**
 * Get full location address string from coordinates using reverse geocoding
 * @param lat Latitude
 * @param lng Longitude
 * @returns Full address string or formatted coordinates if geocoding fails
 */
export const getFullLocationAddress = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
    );
    const data = await response.json();
    
    if (data.address) {
      const addr = data.address;
      // Build a readable address string
      const parts: string[] = [];
      
      if (addr.road) parts.push(addr.road);
      if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
      if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
      if (addr.postcode) parts.push(addr.postcode);
      if (addr.state) parts.push(addr.state);
      
      return parts.length > 0 ? parts.join(', ') : data.display_name || `${lat}, ${lng}`;
    }
    
    return data.display_name || `${lat}, ${lng}`;
  } catch (error) {
    console.error("Error fetching full location address:", error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
};

/**
 * Round minutes to 30-minute blocks (ceiling)
 */
const roundToBlocks = (minutes: number): number => {
  return Math.ceil(minutes / BLOCK_MINUTES) * BLOCK_MINUTES;
};

/**
 * Calculate Overtime Pay with detailed breakdown
 * 
 * Rules:
 * - Weekdays: First 10 hours = Fixed OT (counted but RM 0), After 10 hours = 1.5x
 * - Weekends: First 6 hours = 1.0x, After 6 hours = 1.5x
 * - Public Holidays: First 9 hours = 2.0x, After 9 hours = 3.0x
 * - Outstation Overnight: +RM 30 meal allowance per day
 * - Minimum Block: 30-minute units
 */
export const calculateOvertime = (
  clockIn: Date,
  clockOut: Date,
  isOutstationOvernight: boolean = false,
  isPublicHolidayOverride?: boolean
): OTCalculationBreakdown => {
  const totalMinutes = differenceInMinutes(clockOut, clockIn);
  const dayType = getDayType(clockIn, isPublicHolidayOverride);

  // Initialize breakdown
  const breakdown: OTCalculationBreakdown = {
    duration: totalMinutes,
    dayType,
    fixedOTHours: 0,
    fixedOTMinutes: 0,
    otHours1x: 0,
    otHours1_5x: 0,
    otHours2x: 0,
    otHours3x: 0,
    otMinutes1x: 0,
    otMinutes1_5x: 0,
    otMinutes2x: 0,
    otMinutes3x: 0,
    otAmount1x: 0,
    otAmount1_5x: 0,
    otAmount2x: 0,
    otAmount3x: 0,
    mealAllowance: isOutstationOvernight ? MEAL_ALLOWANCE : 0,
    totalOTAmount: 0,
    totalAmount: 0,
  };

  if (totalMinutes <= 0) {
    breakdown.totalAmount = breakdown.mealAllowance;
    return breakdown;
  }

  let remainingMinutes = totalMinutes;

  if (dayType === 'weekday') {
    // Weekdays: First 10 hours = Fixed OT (not paid), After 10 hours = 1.5x
    if (remainingMinutes > WEEKDAY_FIXED_OT_MINUTES) {
      breakdown.fixedOTMinutes = WEEKDAY_FIXED_OT_MINUTES;
      breakdown.fixedOTHours = WEEKDAY_FIXED_OT_MINUTES / 60;
      
      const otMinutes = remainingMinutes - WEEKDAY_FIXED_OT_MINUTES;
      breakdown.otMinutes1_5x = otMinutes;
      breakdown.otHours1_5x = otMinutes / 60;
    } else {
      // Less than 10 hours worked - all goes to fixed OT (not paid)
      breakdown.fixedOTMinutes = remainingMinutes;
      breakdown.fixedOTHours = remainingMinutes / 60;
    }
  } else if (dayType === 'weekend') {
    // Weekends: First 6 hours = 1.0x, After 6 hours = 1.5x
    if (remainingMinutes > WEEKEND_FIRST_TIER_MINUTES) {
      breakdown.otMinutes1x = WEEKEND_FIRST_TIER_MINUTES;
      breakdown.otHours1x = WEEKEND_FIRST_TIER_MINUTES / 60;
      
      const otMinutes = remainingMinutes - WEEKEND_FIRST_TIER_MINUTES;
      breakdown.otMinutes1_5x = otMinutes;
      breakdown.otHours1_5x = otMinutes / 60;
    } else {
      // Less than 6 hours worked - all at 1.0x
      breakdown.otMinutes1x = remainingMinutes;
      breakdown.otHours1x = remainingMinutes / 60;
    }
  } else if (dayType === 'public_holiday') {
    // Public Holidays: First 9 hours = 2.0x, After 9 hours = 3.0x
    if (remainingMinutes > PUBLIC_HOLIDAY_FIRST_TIER_MINUTES) {
      breakdown.otMinutes2x = PUBLIC_HOLIDAY_FIRST_TIER_MINUTES;
      breakdown.otHours2x = PUBLIC_HOLIDAY_FIRST_TIER_MINUTES / 60;
      
      const otMinutes = remainingMinutes - PUBLIC_HOLIDAY_FIRST_TIER_MINUTES;
      breakdown.otMinutes3x = otMinutes;
      breakdown.otHours3x = otMinutes / 60;
    } else {
      // Less than 9 hours worked - all at 2.0x
      breakdown.otMinutes2x = remainingMinutes;
      breakdown.otHours2x = remainingMinutes / 60;
    }
  }

  // Calculate amounts (rounded to 30-minute blocks)
  if (breakdown.otMinutes1x > 0) {
    const roundedMinutes = roundToBlocks(breakdown.otMinutes1x);
    const hours = roundedMinutes / 60;
    breakdown.otAmount1x = hours * BASE_HOURLY_RATE * RATE_1X;
  }

  if (breakdown.otMinutes1_5x > 0) {
    const roundedMinutes = roundToBlocks(breakdown.otMinutes1_5x);
    const hours = roundedMinutes / 60;
    breakdown.otAmount1_5x = hours * BASE_HOURLY_RATE * RATE_1_5X;
  }

  if (breakdown.otMinutes2x > 0) {
    const roundedMinutes = roundToBlocks(breakdown.otMinutes2x);
    const hours = roundedMinutes / 60;
    breakdown.otAmount2x = hours * BASE_HOURLY_RATE * RATE_2X;
  }

  if (breakdown.otMinutes3x > 0) {
    const roundedMinutes = roundToBlocks(breakdown.otMinutes3x);
    const hours = roundedMinutes / 60;
    breakdown.otAmount3x = hours * BASE_HOURLY_RATE * RATE_3X;
  }

  // Calculate totals
  breakdown.totalOTAmount = 
    breakdown.otAmount1x +
    breakdown.otAmount1_5x +
    breakdown.otAmount2x +
    breakdown.otAmount3x;

  breakdown.totalAmount = breakdown.totalOTAmount + breakdown.mealAllowance;

  return breakdown;
};

/**
 * Clock In Action
 */
export const performClockIn = async (
  userId: string,
  location?: { lat: number, lng: number, postcode: string },
  checkInLocation?: string,
  isPublicHoliday?: boolean
) => {
  const clockInTime = new Date();
  const clockInTimeStr = clockInTime.toISOString();
  
  // Determine day type with manual override if provided
  const dayType = getDayType(clockInTime, isPublicHoliday);
  
  // If location string not provided but coordinates are, fetch it
  let fullLocation = checkInLocation;
  if (!fullLocation && location?.lat && location?.lng) {
    fullLocation = await getFullLocationAddress(location.lat, location.lng);
  }

  const { data, error } = await supabase
    .from('work_logs')
    .insert([
      {
        user_id: userId,
        clock_in: clockInTimeStr,
        duration_minutes: 0,
        overtime_amount: 0,
        clock_in_lat: location?.lat,
        clock_in_lng: location?.lng,
        clock_in_postcode: location?.postcode,
        check_in_location: fullLocation,
        is_public_holiday: isPublicHoliday || false,
        day_type: dayType
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Clock Out Action
 */
export const performClockOut = async (
  logId: string,
  clockInTimeStr: string,
  location?: { lat: number, lng: number, postcode: string },
  isOutstationOvernight: boolean = false,
  checkOutLocation?: string
) => {
  // Fetch existing work log to get stored public holiday status
  const { data: existingLog, error: fetchError } = await supabase
    .from('work_logs')
    .select('is_public_holiday')
    .eq('id', logId)
    .single();

  if (fetchError) {
    console.error('Error fetching work log:', fetchError);
  }

  const clockIn = new Date(clockInTimeStr);
  const clockOut = new Date(); // Now
  const clockOutTimeStr = clockOut.toISOString();

  // Use stored public holiday status if available
  const isPublicHoliday = existingLog?.is_public_holiday || false;
  const calculation = calculateOvertime(clockIn, clockOut, isOutstationOvernight, isPublicHoliday);

  // If location string not provided but coordinates are, fetch it
  let fullLocation = checkOutLocation;
  if (!fullLocation && location?.lat && location?.lng) {
    fullLocation = await getFullLocationAddress(location.lat, location.lng);
  }

  const { data, error } = await supabase
    .from('work_logs')
    .update({
      clock_out: clockOutTimeStr,
      duration_minutes: calculation.duration,
      overtime_amount: calculation.totalOTAmount, // Use total OT amount (excluding meal allowance for OT field)
      clock_out_lat: location?.lat,
      clock_out_lng: location?.lng,
      clock_out_postcode: location?.postcode,
      check_out_location: fullLocation,
      is_outstation: isOutstationOvernight
    })
    .eq('id', logId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Fetch Current Active Session (Not clocked out yet)
 */
export const fetchActiveSession = async (userId: string): Promise<WorkLog | null> => {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('user_id', userId)
    .is('clock_out', null)
    .maybeSingle(); // Use maybeSingle to avoid 406 error if no rows

  if (error) throw error;
  return data;
};

/**
 * Fetch Monthly Summary
 */
export const fetchMonthlySummary = async (userId: string) => {
  const now = new Date();
  const start = startOfMonth(now).toISOString();
  const end = endOfMonth(now).toISOString();

  const { data, error } = await supabase
    .from('work_logs')
    .select('overtime_amount')
    .eq('user_id', userId)
    .gte('clock_in', start)
    .lte('clock_in', end)
    .not('clock_out', 'is', null);

  if (error) throw error;

  const total = data?.reduce((sum, log) => sum + (Number(log.overtime_amount) || 0), 0) || 0;
  return total;
};

/**
 * Fetch Recent Activity
 */
export const fetchRecentLogs = async (userId: string): Promise<WorkLog[]> => {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('user_id', userId)
    .not('clock_out', 'is', null)
    .order('clock_in', { ascending: false })
    .limit(5);

  if (error) throw error;
  return data || [];
};

/**
 * Fetch all work logs for a specific month
 */
export const fetchMonthlyLogs = async (userId: string, year: number, month: number): Promise<WorkLog[]> => {
  const targetDate = new Date(year, month - 1, 1); // month is 1-based
  const start = startOfMonth(targetDate).toISOString();
  const end = endOfMonth(targetDate).toISOString();

  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('clock_in', start)
    .lte('clock_in', end)
    .not('clock_out', 'is', null)
    .order('clock_in', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Exported constants for external use
 */
export const OT_CONSTANTS = {
  BASE_HOURLY_RATE,
  BASIC_SALARY,
  WORK_DAYS_PER_MONTH,
  HOURS_PER_DAY,
  BLOCK_MINUTES,
  MEAL_ALLOWANCE,
  WEEKDAY_FIXED_OT_MINUTES,
  WEEKEND_FIRST_TIER_MINUTES,
  PUBLIC_HOLIDAY_FIRST_TIER_MINUTES,
  RATE_1X,
  RATE_1_5X,
  RATE_2X,
  RATE_3X,
} as const;
