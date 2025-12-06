import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, MapPin, Clock, Calendar, Receipt, DollarSign } from 'lucide-react';
import { WorkLog } from '../types';
import { calculateOvertime, OT_CONSTANTS } from '../services/timeService';
import { supabase } from '../supabaseClient';

interface WorkLogDetailProps {
  workLog: WorkLog;
  onClose: () => void;
}

const WorkLogDetail: React.FC<WorkLogDetailProps> = ({ workLog, onClose }) => {
  const [cumulativeMinutes, setCumulativeMinutes] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  
  // Recalculate breakdown from stored data
  const clockIn = new Date(workLog.clock_in);
  const clockOut = workLog.clock_out ? new Date(workLog.clock_out) : null;
  
  // Fetch cumulative minutes worked earlier in the same day
  useEffect(() => {
    const fetchCumulativeMinutes = async () => {
      if (!clockOut) {
        setLoading(false);
        return;
      }
      
      try {
        // Get the date in YYYY-MM-DD format for comparison
        const dateStr = format(clockIn, 'yyyy-MM-dd');
        const dayStart = new Date(dateStr + 'T00:00:00');
        const dayEnd = new Date(dateStr + 'T23:59:59');
        
        // Fetch all completed work logs for the same day, before the current session
        // We need to find logs that started before the current session's clock_in time
        const { data: sameDayLogs, error } = await supabase
          .from('work_logs')
          .select('duration_minutes, clock_in')
          .eq('user_id', workLog.user_id)
          .not('clock_out', 'is', null)
          .neq('id', workLog.id) // Exclude current log
          .gte('clock_in', dayStart.toISOString())
          .lte('clock_in', dayEnd.toISOString())
          .lt('clock_in', workLog.clock_in); // Only logs that started before this session
        
        if (!error && sameDayLogs) {
          // Sum up all durations from earlier sessions today
          const cumulative = sameDayLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
          setCumulativeMinutes(cumulative);
        }
      } catch (err) {
        console.error('Error fetching cumulative minutes:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCumulativeMinutes();
  }, [workLog.id, workLog.user_id, workLog.clock_in, clockOut]);
  
  // Calculate breakdown if clock out exists
  // Use stored values for is_outstation and is_public_holiday to ensure consistency
  // Include cumulative minutes for accurate calculation
  const breakdown = clockOut && !loading
    ? calculateOvertime(
        clockIn, 
        clockOut, 
        workLog.is_outstation || false,
        workLog.is_public_holiday || false,
        cumulativeMinutes
      )
    : null;

  const totalHours = Math.floor(workLog.duration_minutes / 60);
  const totalMinutes = workLog.duration_minutes % 60;
  const totalWorkDuration = `${totalHours}h ${totalMinutes}m`;

  // Format day type for display
  const formatDayType = (dayType?: string): string => {
    switch (dayType) {
      case 'weekday':
        return 'Weekday';
      case 'weekend':
        return 'Weekend';
      case 'public_holiday':
        return 'Public Holiday';
      default:
        return 'N/A';
    }
  };

  // Format hours and minutes for display
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  // Format hours for display (decimal)
  const formatHours = (minutes: number): string => {
    const hours = (minutes / 60).toFixed(2);
    return hours.replace(/\.?0+$/, ''); // Remove trailing zeros
  };

  // Round minutes to 30-minute blocks (ceiling) - same as calculation logic
  const roundToBlocks = (minutes: number): number => {
    const BLOCK_MINUTES = 30;
    return Math.ceil(minutes / BLOCK_MINUTES) * BLOCK_MINUTES;
  };

  // Format rounded hours for display (shows the rounded hours used in calculation)
  const formatRoundedHours = (minutes: number): string => {
    const roundedMinutes = roundToBlocks(minutes);
    const hours = roundedMinutes / 60;
    // Show with 2 decimal places if needed, otherwise as whole number
    return hours % 1 === 0 ? hours.toString() : hours.toFixed(2);
  };

  const BASE_HOURLY_RATE = OT_CONSTANTS.BASE_HOURLY_RATE;
  const RATE_1_5X = OT_CONSTANTS.RATE_1_5X;
  const RATE_2X = OT_CONSTANTS.RATE_2X;
  const RATE_3X = OT_CONSTANTS.RATE_3X;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={20} />
            <h2 className="text-xl font-bold">
              {format(clockIn, 'MMM d, yyyy')}
            </h2>
          </div>
          <div className="flex items-baseline gap-2">
            <DollarSign size={24} />
            <span className="text-3xl font-bold">
              RM {breakdown ? breakdown.totalOTAmount.toFixed(2) : workLog.overtime_amount.toFixed(2)}
            </span>
          </div>
          {breakdown && Math.abs(breakdown.totalOTAmount - workLog.overtime_amount) > 0.01 && (
            <p className="text-xs text-amber-200 mt-1 bg-amber-800/30 px-2 py-1 rounded">
              ⚠️ Stored amount: RM {workLog.overtime_amount.toFixed(2)} | Recalculated: RM {breakdown.totalOTAmount.toFixed(2)} (showing recalculated)
            </p>
          )}
          {workLog.day_type && (
            <p className="text-sm text-indigo-100 mt-2">
              {formatDayType(workLog.day_type)}
            </p>
          )}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Time & Location Log */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={18} />
              Time & Location
            </h3>

            {/* Check In */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Check In
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {format(clockIn, 'h:mm a')}
                </span>
              </div>
              <div className="flex items-start gap-2 mt-2">
                <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700 flex-1">
                  {workLog.check_in_location || 
                   (workLog.clock_in_postcode ? `Postcode: ${workLog.clock_in_postcode}` : 'Location not available')}
                </p>
              </div>
            </div>

            {/* Check Out */}
            {clockOut ? (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Check Out
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {format(clockOut, 'h:mm a')}
                  </span>
                </div>
                <div className="flex items-start gap-2 mt-2">
                  <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-700 flex-1">
                    {workLog.check_out_location || 
                     (workLog.clock_out_postcode ? `Postcode: ${workLog.clock_out_postcode}` : 'Location not available')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <p className="text-sm text-yellow-800">Not clocked out yet</p>
              </div>
            )}

            {/* Total Duration */}
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-indigo-900">Total Work Duration</span>
                <span className="text-lg font-bold text-indigo-700">{totalWorkDuration}</span>
              </div>
            </div>
          </div>

          {/* Calculation Breakdown */}
          {breakdown && (
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Receipt size={18} />
                Calculation Breakdown
              </h3>

              <div className="bg-white rounded-xl border-2 border-gray-200 p-5 space-y-4">
                {/* Total Work Duration */}
                <div className="pb-3 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-700">
                    Total Work Duration: <span className="font-bold">{totalHours} Hours</span>
                  </p>
                </div>

                {/* Weekday Calculation */}
                {breakdown.dayType === 'weekday' && (
                  <div className="space-y-3">
                    {breakdown.fixedOTHours > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Standard Work (First {Math.round(breakdown.fixedOTHours)} hrs):
                        </span>
                        <span className="font-medium text-gray-500">Covered by Allowance</span>
                      </div>
                    )}
                    {breakdown.otHours1_5x > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Overtime ({formatRoundedHours(breakdown.otMinutes1_5x)} hrs):
                          {Math.abs(roundToBlocks(breakdown.otMinutes1_5x) - breakdown.otMinutes1_5x) > 0.5 && (
                            <span className="text-xs text-gray-400 ml-1">({formatHours(breakdown.otMinutes1_5x)} hrs rounded up)</span>
                          )}
                        </span>
                        <span className="font-semibold text-gray-900 text-right">
                          {formatRoundedHours(breakdown.otMinutes1_5x)} hrs × RM {(BASE_HOURLY_RATE * RATE_1_5X).toFixed(2)} = RM {breakdown.otAmount1_5x.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Weekend Calculation */}
                {breakdown.dayType === 'weekend' && (
                  <div className="space-y-3">
                    {breakdown.otHours1x > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          OT Rate 1.0x ({formatRoundedHours(breakdown.otMinutes1x)} hrs):
                          {Math.abs(roundToBlocks(breakdown.otMinutes1x) - breakdown.otMinutes1x) > 0.5 && (
                            <span className="text-xs text-gray-400 ml-1">({formatHours(breakdown.otMinutes1x)} hrs rounded up)</span>
                          )}
                        </span>
                        <span className="font-semibold text-gray-900 text-right">
                          {formatRoundedHours(breakdown.otMinutes1x)} hrs × RM {BASE_HOURLY_RATE.toFixed(2)} = RM {breakdown.otAmount1x.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {breakdown.otHours1_5x > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          OT Rate 1.5x ({formatRoundedHours(breakdown.otMinutes1_5x)} hrs):
                          {Math.abs(roundToBlocks(breakdown.otMinutes1_5x) - breakdown.otMinutes1_5x) > 0.5 && (
                            <span className="text-xs text-gray-400 ml-1">({formatHours(breakdown.otMinutes1_5x)} hrs rounded up)</span>
                          )}
                        </span>
                        <span className="font-semibold text-gray-900 text-right">
                          {formatRoundedHours(breakdown.otMinutes1_5x)} hrs × RM {(BASE_HOURLY_RATE * RATE_1_5X).toFixed(2)} = RM {breakdown.otAmount1_5x.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Public Holiday Calculation */}
                {breakdown.dayType === 'public_holiday' && (
                  <div className="space-y-3">
                    {breakdown.otHours2x > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          OT Rate 2.0x ({formatRoundedHours(breakdown.otMinutes2x)} hrs):
                          {Math.abs(roundToBlocks(breakdown.otMinutes2x) - breakdown.otMinutes2x) > 0.5 && (
                            <span className="text-xs text-gray-400 ml-1">({formatHours(breakdown.otMinutes2x)} hrs rounded up)</span>
                          )}
                        </span>
                        <span className="font-semibold text-gray-900 text-right">
                          {formatRoundedHours(breakdown.otMinutes2x)} hrs × RM {(BASE_HOURLY_RATE * RATE_2X).toFixed(2)} = RM {breakdown.otAmount2x.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {breakdown.otHours3x > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          OT Rate 3.0x ({formatRoundedHours(breakdown.otMinutes3x)} hrs):
                          {Math.abs(roundToBlocks(breakdown.otMinutes3x) - breakdown.otMinutes3x) > 0.5 && (
                            <span className="text-xs text-gray-400 ml-1">({formatHours(breakdown.otMinutes3x)} hrs rounded up)</span>
                          )}
                        </span>
                        <span className="font-semibold text-gray-900 text-right">
                          {formatRoundedHours(breakdown.otMinutes3x)} hrs × RM {(BASE_HOURLY_RATE * RATE_3X).toFixed(2)} = RM {breakdown.otAmount3x.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Outstation Allowance */}
                {breakdown.mealAllowance > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Outstation Allowance:</span>
                      <span className="font-semibold text-gray-900">RM {breakdown.mealAllowance.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="pt-4 border-t-2 border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-indigo-600">
                      RM {breakdown.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* If no breakdown available */}
          {!breakdown && (
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <p className="text-sm text-yellow-800">
                Calculation breakdown not available. Please clock out to see detailed breakdown.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkLogDetail;

