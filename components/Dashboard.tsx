import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { LogOut, Clock, DollarSign, History, AlertCircle, MapPin, Calendar, Home, BarChart3 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  performClockIn,
  performClockOut,
  fetchActiveSession,
  fetchMonthlySummary,
  fetchRecentLogs,
  getDayType,
  getFullLocationAddress
} from '../services/timeService';
import { WorkLog } from '../types';
import Timer from './Timer';
import WorkLogDetail from './WorkLogDetail';

interface DashboardProps {
  session: any;
  onNavigateToMonthly?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ session, onNavigateToMonthly }) => {
  const [loading, setLoading] = useState(true);
  const [activeLog, setActiveLog] = useState<WorkLog | null>(null);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [recentLogs, setRecentLogs] = useState<WorkLog[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState<WorkLog | null>(null);
  
  // Check-in state
  const [isPublicHoliday, setIsPublicHoliday] = useState<boolean>(false);
  
  // Check-out state
  const [isOutstation, setIsOutstation] = useState<boolean>(false);

  const userId = session.user.id;
  const userEmail = session.user.email;

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [active, total, recent] = await Promise.all([
        fetchActiveSession(userId),
        fetchMonthlySummary(userId),
        fetchRecentLogs(userId)
      ]);

      setActiveLog(active);
      setMonthlyTotal(total);
      setRecentLogs(recent);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-detect public holiday status when component mounts or activeLog changes
  useEffect(() => {
    if (!activeLog) {
      const today = new Date();
      const detectedDayType = getDayType(today);
      setIsPublicHoliday(detectedDayType === 'public_holiday');
    }
  }, [activeLog]);

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            reject(new Error("Unable to retrieve your location"));
          }
        );
      }
    });
  };

  const getPostcode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      return data.address?.postcode || "Unknown";
    } catch (error) {
      console.error("Error fetching postcode:", error);
      return "Unknown";
    }
  };

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      setErrorMsg(null);

      // Get Location
      const location = await getLocation();
      const postcode = await getPostcode(location.lat, location.lng);
      const fullAddress = await getFullLocationAddress(location.lat, location.lng);

      await performClockIn(userId, { ...location, postcode }, fullAddress, isPublicHoliday);
      
      // Reset state after successful clock in
      setIsPublicHoliday(false);
      await refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeLog) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);

      // Get Location
      const location = await getLocation();
      const postcode = await getPostcode(location.lat, location.lng);
      const fullAddress = await getFullLocationAddress(location.lat, location.lng);

      await performClockOut(activeLog.id, activeLog.clock_in, { ...location, postcode }, isOutstation, fullAddress);
      
      // Reset state after successful clock out
      setIsOutstation(false);
      await refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to clock out");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentDate = format(new Date(), 'EEEE, d MMM yyyy');

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto shadow-xl border-x border-gray-200 flex flex-col">
      {/* Header */}
      <header className="bg-white px-6 py-5 border-b border-gray-100 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold text-gray-900">Driver OT Tracker</h1>
          <div className="flex items-center gap-2">
            {onNavigateToMonthly && (
              <button
                onClick={onNavigateToMonthly}
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors p-2 rounded-lg flex items-center gap-2"
                title="View Monthly Dashboard"
              >
                <BarChart3 size={20} />
                <span className="text-sm font-medium hidden sm:inline">Monthly Report</span>
              </button>
            )}
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 transition-colors p-2">
              <LogOut size={20} />
            </button>
          </div>
        </div>
        <p className="text-gray-500 text-sm font-medium">{currentDate}</p>
        <p className="text-xs text-gray-400 mt-1 truncate">Logged in as: {userEmail}</p>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Status Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
          <div className="mb-6">
            <div className={`inline-flex items-center justify-center p-3 rounded-full mb-4 ${activeLog ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              <Clock size={32} />
            </div>
            {activeLog ? (
              <div>
                <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-1">Current Status</h2>
                <Timer startTime={activeLog.clock_in} />
                <p className="text-xs text-gray-400 mt-2">Started at {format(new Date(activeLog.clock_in), 'h:mm a')}</p>
              </div>
            ) : (
              <div>
                <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-1">Status</h2>
                <p className="font-mono text-xl font-bold text-gray-800">Not Working</p>
              </div>
            )}
          </div>

          {!activeLog ? (
            <>
              {/* Public Holiday Checkbox for Check-in */}
              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isPublicHoliday}
                      onChange={(e) => setIsPublicHoliday(e.target.checked)}
                      disabled={actionLoading}
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                        isPublicHoliday
                          ? 'bg-indigo-600'
                          : 'bg-gray-300'
                      } ${actionLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group-hover:bg-opacity-80'}`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          isPublicHoliday ? 'translate-x-5' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Calendar size={18} className={isPublicHoliday ? 'text-indigo-600' : 'text-gray-500'} />
                    <span className={`text-sm font-medium ${isPublicHoliday ? 'text-indigo-900' : 'text-gray-700'}`}>
                      Is Today a Public Holiday?
                    </span>
                  </div>
                </label>
              </div>

              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-emerald-200 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {actionLoading ? 'Processing...' : 'CLOCK IN'}
              </button>
            </>
          ) : (
            <>
              {/* Outstation Checkbox for Check-out */}
              <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isOutstation}
                      onChange={(e) => setIsOutstation(e.target.checked)}
                      disabled={actionLoading}
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                        isOutstation
                          ? 'bg-amber-600'
                          : 'bg-gray-300'
                      } ${actionLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group-hover:bg-opacity-80'}`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          isOutstation ? 'translate-x-5' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Home size={18} className={isOutstation ? 'text-amber-600' : 'text-gray-500'} />
                    <span className={`text-sm font-medium ${isOutstation ? 'text-amber-900' : 'text-gray-700'}`}>
                      Did you stay overnight (Outstation)?
                    </span>
                  </div>
                </label>
                {isOutstation && (
                  <p className="text-xs text-amber-700 mt-2 ml-14">
                    RM 30 meal allowance will be added
                  </p>
                )}
              </div>

              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-rose-200 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {actionLoading ? 'Calculating...' : 'CLOCK OUT'}
              </button>
            </>
          )}
        </div>

        {/* Summary Card */}
        <div className="bg-indigo-600 rounded-2xl p-6 shadow-lg text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign size={100} />
          </div>
          <p className="text-indigo-200 text-sm font-medium mb-1">Current Month OT Earnings</p>
          <h3 className="text-4xl font-bold">RM {monthlyTotal.toFixed(2)}</h3>
          <p className="text-xs text-indigo-300 mt-2">Rate: RM 11.50 / 30 mins block</p>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center gap-2 mb-4 text-gray-800">
            <History size={18} />
            <h3 className="font-semibold">Recent Activity</h3>
          </div>

          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">No recent records found.</p>
            ) : (
              recentLogs.map((log) => {
                const date = new Date(log.clock_in);
                const hours = Math.floor(log.duration_minutes / 60);
                const mins = log.duration_minutes % 60;

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedWorkLog(log)}
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{format(date, 'MMM d, yyyy')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {hours}h {mins}m worked
                      </p>
                      {(log.check_in_location || log.clock_in_postcode) && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} /> {log.check_in_location || log.clock_in_postcode}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`block font-bold ${log.overtime_amount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        RM {Number(log.overtime_amount).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">OT PAY</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Work Log Detail Modal */}
      {selectedWorkLog && (
        <WorkLogDetail
          workLog={selectedWorkLog}
          onClose={() => setSelectedWorkLog(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
