/*
# Create loans and payments schema

1. New Tables
- `loans` - stores loan information
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, defaults to auth.uid())
  - `name` (text, name of the loan)
  - `lender` (text, institution or person lending)
  - `principal_amount` (decimal, original loan amount)
  - `interest_rate` (decimal, annual interest rate percentage)
  - `interest_type` (text, 'fixed' or 'variable')
  - `start_date` (date, when loan was taken)
  - `due_date` (date, final due date)
  - `status` (text, 'active', 'paid_off', 'defaulted')
  - `description` (text, optional notes)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

- `payments` - tracks individual loan payments
  - `id` (uuid, primary key)
  - `loan_id` (uuid, references loans)
  - `user_id` (uuid, references auth.users, defaults to auth.uid())
  - `amount` (decimal, payment amount)
  - `principal_paid` (decimal, portion going to principal)
  - `interest_paid` (decimal, portion going to interest)
  - `payment_date` (date, when payment was made)
  - `payment_method` (text, 'bank_transfer', 'cash', 'check', 'card', 'other')
  - `notes` (text, optional notes)
  - `created_at` (timestamp)

2. Security
- Enable RLS on both tables
- Owner-scoped CRUD: authenticated users can only access their own data
- Payments inherit ownership from loans via user_id column

3. Indexes
- Index on user_id for both tables (optimizes RLS checks)
- Index on loan_id for payments table (optimizes payment queries)
*/

CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  lender text NOT NULL,
  principal_amount decimal(15,2) NOT NULL,
  interest_rate decimal(5,2) DEFAULT 0,
  interest_type text DEFAULT 'fixed' CHECK (interest_type IN ('fixed', 'variable')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted')),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_loans" ON loans;
CREATE POLICY "select_own_loans" ON loans FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_loans" ON loans;
CREATE POLICY "insert_own_loans" ON loans FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_loans" ON loans;
CREATE POLICY "update_own_loans" ON loans FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_loans" ON loans;
CREATE POLICY "delete_own_loans" ON loans FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(15,2) NOT NULL,
  principal_paid decimal(15,2) DEFAULT 0,
  interest_paid decimal(15,2) DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'card', 'other')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payments" ON payments;
CREATE POLICY "insert_own_payments" ON payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payments" ON payments;
CREATE POLICY "update_own_payments" ON payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_payments" ON payments;
CREATE POLICY "delete_own_payments" ON payments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON payments(loan_id);
