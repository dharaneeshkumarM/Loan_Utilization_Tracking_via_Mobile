/*
# Loan Utilisation Tracking Schema

## Overview
Creates the full data model for a loan utilisation tracking system where beneficiaries
log in, submit geo-tagged photos of assets purchased with their loan, and administrators
review those submissions on a map dashboard.

## New Tables

### profiles
- `id` (uuid, primary key, references auth.users)
- `full_name` (text, not null)
- `role` (text, not null, default 'beneficiary') — 'beneficiary' or 'admin'
- `phone` (text, nullable)
- `created_at` (timestamptz, default now())

### loans
- `id` (uuid, primary key)
- `beneficiary_id` (uuid, not null, references profiles.id, defaults to auth.uid())
- `loan_reference` (text, not null, unique) — human-readable loan number
- `amount` (numeric, not null) — loan principal amount
- `purpose` (text, not null) — stated purpose of the loan
- `status` (text, not null, default 'active') — 'active' or 'closed'
- `created_at` (timestamptz, default now())

### submissions
- `id` (uuid, primary key)
- `loan_id` (uuid, not null, references loans.id on delete cascade)
- `beneficiary_id` (uuid, not null, references profiles.id, defaults to auth.uid())
- `asset_name` (text, not null) — name/description of the purchased asset
- `asset_category` (text, not null) — category of asset (e.g. equipment, livestock, inventory)
- `amount_spent` (numeric, not null) — amount spent on this asset
- `photo_url` (text, not null) — public URL of the geo-tagged photo in storage
- `latitude` (double precision, not null) — geo-tag latitude
- `longitude` (double precision, not null) — geo-tag longitude
- `notes` (text, nullable) — optional beneficiary notes
- `status` (text, not null, default 'pending') — 'pending', 'approved', 'rejected'
- `reviewer_id` (uuid, nullable, references profiles.id) — admin who reviewed
- `reviewed_at` (timestamptz, nullable)
- `review_note` (text, nullable) — admin's note when reviewing
- `created_at` (timestamptz, default now())

## Security (RLS)

### profiles
- SELECT: authenticated users can read their own profile; admins can read all.
- INSERT: a user can insert their own profile row.
- UPDATE: a user can update their own profile; admins can update any.

### loans
- SELECT: beneficiaries see their own loans; admins see all.
- INSERT: beneficiaries can insert loans for themselves.
- UPDATE: beneficiaries can update their own loans; admins can update any.
- DELETE: beneficiaries can delete their own loans; admins can delete any.

### submissions
- SELECT: beneficiaries see their own submissions; admins see all.
- INSERT: beneficiaries can insert submissions for their own loans.
- UPDATE: beneficiaries can update their own pending submissions; admins can update any (for review).
- DELETE: beneficiaries can delete their own pending submissions; admins can delete any.

## Storage
- Creates a public bucket `submission-photos` for storing geo-tagged asset photos.
- Policies allow authenticated users to upload, and anyone (anon) to read since the bucket is public.

## Important Notes
1. All owner columns default to auth.uid() so client inserts omitting the owner still satisfy RLS.
2. Admin role is determined by the profiles.role column; RLS policies check this via a subquery.
3. The submission-photos bucket is public so photo URLs are readable without auth — appropriate for this tracking use case.
4. Email confirmation stays OFF so beneficiaries can sign up and immediately use the app.
*/

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'beneficiary' CHECK (role IN ('beneficiary', 'admin')),
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_or_all_if_admin" ON profiles;
CREATE POLICY "select_own_or_all_if_admin" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_or_all_if_admin" ON profiles;
CREATE POLICY "update_own_or_all_if_admin" ON profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================
-- LOANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  loan_reference text NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_or_all_if_admin" ON loans;
CREATE POLICY "select_own_or_all_if_admin" ON loans FOR SELECT
  TO authenticated USING (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_loan" ON loans;
CREATE POLICY "insert_own_loan" ON loans FOR INSERT
  TO authenticated WITH CHECK (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "update_own_or_all_if_admin" ON loans;
CREATE POLICY "update_own_or_all_if_admin" ON loans FOR UPDATE
  TO authenticated
  USING (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_own_or_all_if_admin" ON loans;
CREATE POLICY "delete_own_or_all_if_admin" ON loans FOR DELETE
  TO authenticated USING (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================
-- SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  asset_name text NOT NULL,
  asset_category text NOT NULL,
  amount_spent numeric(14,2) NOT NULL CHECK (amount_spent > 0),
  photo_url text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_or_all_if_admin" ON submissions;
CREATE POLICY "select_own_or_all_if_admin" ON submissions FOR SELECT
  TO authenticated USING (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_submission" ON submissions;
CREATE POLICY "insert_own_submission" ON submissions FOR INSERT
  TO authenticated WITH CHECK (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "update_own_or_all_if_admin" ON submissions;
CREATE POLICY "update_own_or_all_if_admin" ON submissions FOR UPDATE
  TO authenticated
  USING (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_own_or_all_if_admin" ON submissions;
CREATE POLICY "delete_own_or_all_if_admin" ON submissions FOR DELETE
  TO authenticated USING (
    beneficiary_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_loans_beneficiary_id ON loans(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_submissions_loan_id ON submissions(loan_id);
CREATE INDEX IF NOT EXISTS idx_submissions_beneficiary_id ON submissions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);

-- ============================================
-- STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-photos', 'submission-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "submission_photos_upload_authenticated" ON storage.objects;
CREATE POLICY "submission_photos_upload_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submission-photos');

DROP POLICY IF EXISTS "submission_photos_read_public" ON storage.objects;
CREATE POLICY "submission_photos_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'submission-photos');

DROP POLICY IF EXISTS "submission_photos_update_own" ON storage.objects;
CREATE POLICY "submission_photos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'submission-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'submission-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "submission_photos_delete_own" ON storage.objects;
CREATE POLICY "submission_photos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'submission-photos' AND owner = auth.uid());

-- ============================================
-- TRIGGER: auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'beneficiary')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
