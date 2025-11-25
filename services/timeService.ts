import { differenceInMinutes, startOfMonth, endOfMonth, isSaturday, isSunday, format } from 'date-fns';
import { supabase } from '../supabaseClient';
import { WorkLog } from '../types';

/**
 * Constants
 */
const STANDARD_WORK_MINUTES = 600; // 10 hours
const RATE_PER_BLOCK = 11.50;
const BLOCK_MINUTES = 30;

/**
 * Calculate Overtime Pay
 * Rules:
 * 1. Weekend = All time is OT.
 * 2. Weekday = Time - 10 hours (600 mins).
 * 3. Ceiling function on 30 min blocks.
 */
export const calculateOvertime = (clockIn: Date, clockOut: Date): { duration: number; otPay: number } => {
  const totalMinutes = differenceInMinutes(clockOut, clockIn);
  let otMinutes = 0;

  const isWeekend = isSaturday(clockIn) || isSunday(clockIn);

  if (isWeekend) {
    // Rule: Weekend - Every minute is overtime
    otMinutes = totalMinutes;
  } else {
    // Rule: Weekday - OT = TotalMinutes - 600
    // If negative, it means they worked less than 10 hours, so 0 OT.
    otMinutes = Math.max(0, totalMinutes - STANDARD_WORK_MINUTES);
  }

  // Pricing Logic: Ceiling Function
  // Even 1 minute of OT counts as a full 30-minute block.
  const blocks = Math.ceil(otMinutes / BLOCK_MINUTES);
  const otPay = blocks * RATE_PER_BLOCK;

  return {
    duration: totalMinutes,
    otPay: otPay
  };
};

/**
 * Clock In Action
 */
export const performClockIn = async (userId: string, location?: { lat: number, lng: number, postcode: string }) => {
  const { data, error } = await supabase
    .from('work_logs')
    .insert([
      {
        user_id: userId,
        clock_in: new Date().toISOString(),
        duration_minutes: 0,
        overtime_amount: 0,
        clock_in_lat: location?.lat,
        clock_in_lng: location?.lng,
        clock_in_postcode: location?.postcode
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
export const performClockOut = async (logId: string, clockInTimeStr: string, location?: { lat: number, lng: number, postcode: string }) => {
  const clockIn = new Date(clockInTimeStr);
  const clockOut = new Date(); // Now

  const calculation = calculateOvertime(clockIn, clockOut);

  const { data, error } = await supabase
    .from('work_logs')
    .update({
      clock_out: clockOut.toISOString(),
      duration_minutes: calculation.duration,
      overtime_amount: calculation.otPay,
      clock_out_lat: location?.lat,
      clock_out_lng: location?.lng,
      clock_out_postcode: location?.postcode
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
