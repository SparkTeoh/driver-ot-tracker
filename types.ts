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
}

export interface OTSummary {
  totalAmount: number;
  totalHours: number;
}
