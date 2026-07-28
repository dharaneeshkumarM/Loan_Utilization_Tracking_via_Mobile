import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type UserRole = 'beneficiary' | 'admin';

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  created_at: string;
};

export type Loan = {
  id: string;
  beneficiary_id: string;
  loan_reference: string;
  amount: number;
  purpose: string;
  status: 'active' | 'closed';
  created_at: string;
};

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export type Submission = {
  id: string;
  loan_id: string;
  beneficiary_id: string;
  asset_name: string;
  asset_category: string;
  amount_spent: number;
  photo_url: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  status: SubmissionStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type SubmissionWithRelations = Submission & {
  loan?: Loan;
  beneficiary?: Profile;
};
