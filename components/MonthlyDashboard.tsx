import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, getMonth, getYear } from 'date-fns';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, FileText, MapPin, AlertCircle } from 'lucide-react';
import { WorkLog, MonthlySummary, MonthlyLogRecord, DayType } from '../types';
import { fetchMonthlyLogs, calculateOvertime } from '../services/timeService';

interface MonthlyDashboardProps {
  session: any;
  onBack: () => void;
}

const BASIC_SALARY = 3200;
const FIXED_OT_ALLOWANCE = 440;
const FOOD_ALLOWANCE = 250;
const FULL_ATTENDANCE_REWARD = 300;
const MEAL_ALLOWANCE = 30; // Per outstation (for outstation overnight)

/**
 * Format decimal hours to "Xh Ym" format
 * @param decimalHours Decimal hours (e.g., 9.52)
 * @returns Formatted string (e.g., "9h 31m")
 */
const formatDuration = (decimalHours: number): string => {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  
  if (hours === 0 && minutes === 0) {
    return '0h';
  }
  
  if (hours === 0) {
    return `${minutes}m`;
  }
  
  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}m`;
};

/**
 * Truncate long text with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text
 */
const truncateText = (text: string, maxLength: number = 40): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Fetch leave records for a month
 * TODO: Implement leave tracking system
 * For now, this returns an empty array - to be connected to leave records table
 */
const fetchMonthlyLeaves = async (userId: string, year: number, month: number): Promise<any[]> => {
  // TODO: Implement leave fetching from database
  // This should query a 'leaves' or 'absences' table
  // Expected structure: { date: string, leave_type: 'medical' | 'annual' | 'emergency' }
  return [];
};

const MonthlyDashboard: React.FC<MonthlyDashboardProps> = ({ session, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()) + 1); // 1-based
  const [monthlyLogs, setMonthlyLogs] = useState<MonthlyLogRecord[]>([]);
  const [summary, setSummary] = useState<MonthlySummary>({
    basicSalary: BASIC_SALARY,
    fixedOTAllowance: FIXED_OT_ALLOWANCE,
    totalOTPay: 0,
    foodAllowance: FOOD_ALLOWANCE,
    fullAttendanceReward: 0,
    outstationMealAllowances: 0,
    grandTotal: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userId = session.user.id;

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      options.push({
        value: `${date.getFullYear()}-${date.getMonth() + 1}`,
        label: format(date, 'MMMM yyyy'),
        year: date.getFullYear(),
        month: date.getMonth() + 1,
      });
    }
    return options;
  };

  // Format day type for display
  const formatDayType = (dayType?: DayType): string => {
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

  // Get badge styling for day type
  const getDayTypeBadgeStyle = (dayType?: DayType, isPublicHoliday?: boolean): string => {
    if (isPublicHoliday || dayType === 'public_holiday') {
      return 'bg-red-100 text-red-800 border border-red-200';
    }
    if (dayType === 'weekend') {
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    }
    return 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  // Calculate monthly totals
  const calculateMonthlyTotals = useCallback(async (logs: WorkLog[], year: number, month: number): Promise<MonthlySummary> => {
    let totalOTPay = 0;
    let outstationMealAllowances = 0;
    
    // Process each log
    logs.forEach((log) => {
      if (log.clock_out) {
        const clockIn = new Date(log.clock_in);
        const clockOut = new Date(log.clock_out);
        
        // Recalculate breakdown for accurate totals
        const breakdown = calculateOvertime(
          clockIn,
          clockOut,
          log.is_outstation || false,
          log.is_public_holiday || false
        );
        
        totalOTPay += breakdown.totalOTAmount;
        
        // Add meal allowance if outstation
        if (log.is_outstation) {
          outstationMealAllowances += MEAL_ALLOWANCE;
        }
      }
    });

    // Calculate Full Attendance Reward
    // Fixed base: RM 300, get full if no Annual, Emergency, or Medical Leave
    let fullAttendanceReward = FULL_ATTENDANCE_REWARD;
    
    // Fetch leave records for this month
    const leaves = await fetchMonthlyLeaves(userId, year, month);
    
    // Check if any leave was taken - if yes, set reward to 0
    const hasLeave = leaves.some((leave) => {
      const leaveType = leave.leave_type?.toLowerCase();
      return leaveType === 'medical' || 
             leaveType === 'medical_leave' ||
             leaveType === 'annual' || 
             leaveType === 'annual_leave' ||
             leaveType === 'emergency' || 
             leaveType === 'emergency_leave';
    });
    
    // Get full reward only if no leave was taken
    if (hasLeave) {
      fullAttendanceReward = 0;
    }

    const grandTotal = BASIC_SALARY + 
                       FIXED_OT_ALLOWANCE + 
                       totalOTPay + 
                       FOOD_ALLOWANCE + 
                       fullAttendanceReward + 
                       outstationMealAllowances;

    return {
      basicSalary: BASIC_SALARY,
      fixedOTAllowance: FIXED_OT_ALLOWANCE,
      totalOTPay,
      foodAllowance: FOOD_ALLOWANCE,
      fullAttendanceReward,
      outstationMealAllowances,
      grandTotal,
    };
  }, [userId]);

  // Transform work logs to monthly log records
  const transformLogsToRecords = useCallback((logs: WorkLog[]): MonthlyLogRecord[] => {
    return logs.map((log) => {
      const clockIn = new Date(log.clock_in);
      const clockOut = log.clock_out ? new Date(log.clock_out) : null;
      
      let otAmount = 0;
      let allowanceAmount = 0;
      
      if (clockOut) {
        const breakdown = calculateOvertime(
          clockIn,
          clockOut,
          log.is_outstation || false,
          log.is_public_holiday || false
        );
        otAmount = breakdown.totalOTAmount;
        allowanceAmount = breakdown.mealAllowance;
      }

      const totalHours = log.duration_minutes / 60;

      return {
        date: format(clockIn, 'yyyy-MM-dd'),
        dayType: log.day_type || 'weekday',
        checkInLocation: log.check_in_location || log.clock_in_postcode || 'N/A',
        checkOutLocation: log.check_out_location || log.clock_out_postcode || 'N/A',
        totalHours,
        otAmount,
        allowanceAmount,
        isPublicHoliday: log.is_public_holiday || false,
        isOutstation: log.is_outstation || false,
        workLog: log,
      };
    });
  }, []);

  // Fetch monthly data
  const fetchMonthlyData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const logs = await fetchMonthlyLogs(userId, selectedYear, selectedMonth);
      
      // Transform and set logs
      const records = transformLogsToRecords(logs);
      setMonthlyLogs(records);
      
      // Calculate and set summary
      const totals = await calculateMonthlyTotals(logs, selectedYear, selectedMonth);
      setSummary(totals);
    } catch (err: any) {
      console.error('Error fetching monthly data:', err);
      setErrorMsg(err.message || 'Failed to load monthly data.');
      setMonthlyLogs([]);
      setSummary({
        basicSalary: BASIC_SALARY,
        fixedOTAllowance: FIXED_OT_ALLOWANCE,
        totalOTPay: 0,
        foodAllowance: FOOD_ALLOWANCE,
        fullAttendanceReward: 0,
        outstationMealAllowances: 0,
        grandTotal: BASIC_SALARY + FIXED_OT_ALLOWANCE + FOOD_ALLOWANCE,
      });
    } finally {
      setLoading(false);
    }
  }, [userId, selectedYear, selectedMonth, transformLogsToRecords, calculateMonthlyTotals]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  // Handle month selection change
  const handleMonthChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const monthOptions = getMonthOptions();
  const currentMonthValue = `${selectedYear}-${selectedMonth}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-6xl mx-auto shadow-xl border-x border-gray-200">
      {/* Header */}
      <header className="bg-white px-6 py-5 border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Monthly Dashboard</h1>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-gray-500" />
          <select
            value={currentMonthValue}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Basic Salary */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={24} className="opacity-80" />
            </div>
            <p className="text-blue-100 text-sm font-medium mb-1">Basic Salary</p>
            <h3 className="text-2xl font-bold">RM {summary.basicSalary.toFixed(2)}</h3>
          </div>

          {/* Fixed OT Allowance */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={24} className="opacity-80" />
            </div>
            <p className="text-purple-100 text-sm font-medium mb-1">Fixed OT Allowance</p>
            <h3 className="text-2xl font-bold">RM {summary.fixedOTAllowance.toFixed(2)}</h3>
          </div>

          {/* Total OT Pay */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={24} className="opacity-80" />
            </div>
            <p className="text-green-100 text-sm font-medium mb-1">Total OT Pay</p>
            <h3 className="text-2xl font-bold">RM {summary.totalOTPay.toFixed(2)}</h3>
          </div>

          {/* Food Allowance */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <FileText size={24} className="opacity-80" />
            </div>
            <p className="text-amber-100 text-sm font-medium mb-1">Food Allowance</p>
            <h3 className="text-2xl font-bold">RM {(summary.foodAllowance + summary.outstationMealAllowances).toFixed(2)}</h3>
            {summary.outstationMealAllowances > 0 && (
              <p className="text-xs text-amber-100 mt-1">
                Base: RM {summary.foodAllowance.toFixed(2)} | Outstation: RM {summary.outstationMealAllowances.toFixed(2)}
              </p>
            )}
          </div>

          {/* Full Attendance Reward */}
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <FileText size={24} className="opacity-80" />
            </div>
            <p className="text-pink-100 text-sm font-medium mb-1">Full Attendance Reward</p>
            <h3 className="text-2xl font-bold">RM {summary.fullAttendanceReward.toFixed(2)}</h3>
            <p className="text-xs text-pink-100 mt-1">
              Full if no Annual, Emergency, or Medical Leave
            </p>
          </div>

          {/* Grand Total */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={24} className="opacity-80" />
            </div>
            <p className="text-indigo-100 text-sm font-medium mb-1">Grand Total</p>
            <h3 className="text-3xl font-bold">RM {summary.grandTotal.toFixed(2)}</h3>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Detailed Records</h2>
            <p className="text-sm text-gray-500 mt-1">
              {monthlyLogs.length} record{monthlyLogs.length !== 1 ? 's' : ''} found for {format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy')}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Check In Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Check Out Location</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">OT Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Allowance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No records found for this month.
                    </td>
                  </tr>
                ) : (
                  monthlyLogs.map((record, index) => {
                    const highlightRow = record.isPublicHoliday || record.isOutstation;
                    return (
                      <tr
                        key={record.workLog.id || index}
                        className={`hover:bg-gray-50 transition-colors ${
                          highlightRow ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {format(new Date(record.date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getDayTypeBadgeStyle(record.dayType, record.isPublicHoliday)}`}
                            >
                              {formatDayType(record.dayType)}
                            </span>
                            {record.isPublicHoliday && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-200 text-red-900 border border-red-300">
                                PH
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 min-w-[200px]">
                          <div className="flex items-center gap-1">
                            <MapPin size={14} className="text-gray-400 shrink-0" />
                            <span className="truncate" title={record.checkInLocation}>
                              {truncateText(record.checkInLocation, 40)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 min-w-[200px]">
                          <div className="flex items-center gap-1">
                            <MapPin size={14} className="text-gray-400 shrink-0" />
                            <span className="truncate" title={record.checkOutLocation}>
                              {truncateText(record.checkOutLocation, 40)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          {formatDuration(record.totalHours)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                          RM {record.otAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <div className="flex flex-col items-end gap-1">
                            {record.isOutstation && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                Outstation (+RM{MEAL_ALLOWANCE})
                              </span>
                            )}
                            {record.isPublicHoliday && !record.isOutstation && (
                              <span className="text-xs text-gray-500">Public Holiday Rate</span>
                            )}
                            {!record.isOutstation && !record.isPublicHoliday && (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MonthlyDashboard;
