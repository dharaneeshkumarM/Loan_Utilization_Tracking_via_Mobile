export type Loan = {
  id: string;
  user_id: string;
  name: string;
  lender: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: 'fixed' | 'variable';
  start_date: string;
  due_date: string | null;
  status: 'active' | 'paid_off' | 'defaulted';
  description: string | null;
  monthly_emi: number;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  principal_paid: number;
  interest_paid: number;
  payment_date: string;
  payment_method: 'bank_transfer' | 'cash' | 'check' | 'card' | 'other';
  notes: string | null;
  is_late: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  amount: number;
  merchant: string | null;
  category: string;
  expense_date: string;
  description: string | null;
  scanned: boolean;
  gst_amount: number;
  receipt_url: string | null;
  created_at: string;
};

export type FamilyMember = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  relationship: string;
  share_percentage: number;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type LoginActivity = {
  id: string;
  user_id: string;
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  location: string | null;
  is_suspicious: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  budget_limit: number;
  created_at: string;
};

export type SavingsGoal = {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  category: string;
  color: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: 'emi_reminder' | 'overdue' | 'tip' | 'alert' | 'achievement';
  title: string;
  body: string;
  is_read: boolean;
  related_loan_id: string | null;
  due_date: string | null;
  created_at: string;
};

export type Feedback = {
  id: string;
  user_id: string;
  rating: number;
  message: string | null;
  category: string;
  created_at: string;
};

export type LoanInsert = {
  name: string;
  lender: string;
  principal_amount: number;
  interest_rate?: number;
  interest_type?: 'fixed' | 'variable';
  start_date: string;
  due_date?: string | null;
  status?: 'active' | 'paid_off' | 'defaulted';
  description?: string | null;
  monthly_emi?: number;
};

export type LoanUpdate = {
  name?: string;
  lender?: string;
  principal_amount?: number;
  interest_rate?: number;
  interest_type?: 'fixed' | 'variable';
  start_date?: string;
  due_date?: string | null;
  status?: 'active' | 'paid_off' | 'defaulted';
  description?: string | null;
  monthly_emi?: number;
};

export type PaymentInsert = {
  loan_id: string;
  amount: number;
  principal_paid?: number;
  interest_paid?: number;
  payment_date: string;
  payment_method?: 'bank_transfer' | 'cash' | 'check' | 'card' | 'other';
  notes?: string | null;
  is_late?: boolean;
};

export type PaymentUpdate = {
  amount?: number;
  principal_paid?: number;
  interest_paid?: number;
  payment_date?: string;
  payment_method?: 'bank_transfer' | 'cash' | 'check' | 'card' | 'other';
  notes?: string | null;
  is_late?: boolean;
};

export type ExpenseInsert = {
  amount: number;
  merchant?: string | null;
  category?: string;
  expense_date?: string;
  description?: string | null;
  scanned?: boolean;
  gst_amount?: number;
  receipt_url?: string | null;
};

export type SavingsGoalInsert = {
  title: string;
  target_amount: number;
  current_amount?: number;
  target_date?: string | null;
  category?: string;
  color?: string;
};

export type SavingsGoalUpdate = {
  title?: string;
  target_amount?: number;
  current_amount?: number;
  target_date?: string | null;
  category?: string;
  color?: string;
  is_completed?: boolean;
};

export type NotificationInsert = {
  type: 'emi_reminder' | 'overdue' | 'tip' | 'alert' | 'achievement';
  title: string;
  body: string;
  related_loan_id?: string | null;
  due_date?: string | null;
};

export type FeedbackInsert = {
  rating: number;
  message?: string | null;
  category?: string;
};

export interface Database {
  public: {
    Tables: {
      loans: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      payments: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      expenses: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      family_members: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      chat_messages: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      login_activity: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      categories: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      savings_goals: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      notifications: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      feedback: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
    };
    Views: Record<string, any>;
    Functions: Record<string, any>;
    Enums: Record<string, string>;
  };
}
