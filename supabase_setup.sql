-- ==========================================================
-- 1. DATABASE SCHEMA SETUP & TABLE CREATION
-- ==========================================================

-- Table: public.user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'employee', 'accounts')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID, -- Track who added this profile
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: public.expense_archives
CREATE TABLE IF NOT EXISTS public.expense_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    archive_month INT NOT NULL CHECK (archive_month BETWEEN 1 AND 12),
    archive_year INT NOT NULL,
    archive_name TEXT NOT NULL, -- e.g. "June 2026"
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: public.expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    expense_type TEXT NOT NULL CHECK (
        expense_type IN (
            'Food', 'Petrol', 'Travel', 'Accommodation', 'Office Supplies', 
            'Medical', 'Internet', 'Subscription', 'Society Maintenance', 
            'Electricity', 'Vendor', 'Other'
        )
    ),
    custom_type TEXT, -- Used when expense_type = 'Other'
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL,
    notes TEXT,
    proof_url TEXT, -- URL pointing to the proof file
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archive_id UUID REFERENCES public.expense_archives(id) ON DELETE SET NULL,
    
    -- New Workflow Fields
    workflow_status TEXT NOT NULL DEFAULT 'Pending Accounts Approval' CHECK (
        workflow_status IN (
            'Pending Accounts Approval', 
            'Approved by Accounts', 
            'Rejected by Accounts', 
            'Approved by Admin', 
            'Rejected by Admin'
        )
    ),
    accounts_status TEXT NOT NULL DEFAULT 'pending' CHECK (accounts_status IN ('pending', 'approved', 'rejected')),
    accounts_approved_by UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
    accounts_approved_at TIMESTAMPTZ,
    accounts_remarks TEXT,
    
    admin_status TEXT NOT NULL DEFAULT 'pending' CHECK (admin_status IN ('pending', 'approved', 'rejected')),
    admin_approved_by UUID REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
    admin_approved_at TIMESTAMPTZ,
    admin_remarks TEXT,
    
    approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Meta inputs
    expense_nature TEXT NOT NULL CHECK (expense_nature IN ('Reimbursement', 'Vendor Payment', 'Purchase')),
    gst_type TEXT NOT NULL CHECK (gst_type IN ('GST Bill', 'Non-GST Bill')),
    payment_term TEXT NOT NULL CHECK (
        payment_term IN (
            'Pay Today', 'Within 3 Days', 'Within 7 Days', 'End of Week', 
            'Month End', 'Immediate', 'Custom'
        )
    ),
    custom_payment_term TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Turn on Row Level Security (RLS) on all tables to secure them
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_archives ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 2. HELPER FUNCTIONS FOR RLS POLICIES
-- ==========================================================

-- Helper function to check if current visitor is an active Administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to check if current visitor is an active Admin or Accounts user
CREATE OR REPLACE FUNCTION public.is_admin_or_accounts()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'accounts') AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Helper to verify if user has active profile
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- ==========================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES FOR TABLES
-- ==========================================================

-- A. USER PROFILES POLICIES
CREATE POLICY "Admins have full access to profiles" 
ON public.user_profiles FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins and Accounts can select profiles" 
ON public.user_profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can read own profile" 
ON public.user_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own name" 
ON public.user_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = (SELECT role FROM public.user_profiles WHERE user_id = auth.uid())
);

-- B. EXPENSES POLICIES
CREATE POLICY "Admins have full read/write on all expenses"
ON public.expenses FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Accounts users have full select and update privileges to do workflow management
CREATE POLICY "Accounts can select all expenses"
ON public.expenses FOR SELECT TO authenticated
USING (public.is_admin_or_accounts());

CREATE POLICY "Accounts can update all expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (public.is_admin_or_accounts())
WITH CHECK (public.is_admin_or_accounts());

CREATE POLICY "Employees can view own expenses"
ON public.expenses FOR SELECT TO authenticated
USING (auth.uid() = employee_id AND public.is_active_user());

CREATE POLICY "Employees can create their own expenses"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = employee_id AND public.is_active_user());

CREATE POLICY "Employees can update their unarchived expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (auth.uid() = employee_id AND is_archived = false AND public.is_active_user())
WITH CHECK (auth.uid() = employee_id AND is_archived = false AND public.is_active_user());

CREATE POLICY "Employees can delete their unarchived expenses"
ON public.expenses FOR DELETE TO authenticated
USING (auth.uid() = employee_id AND is_archived = false AND public.is_active_user());

-- C. EXPENSE ARCHIVES POLICIES
CREATE POLICY "Admins have complete control of archives"
ON public.expense_archives FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Accounts can view archives"
ON public.expense_archives FOR SELECT TO authenticated
USING (public.is_admin_or_accounts());

CREATE POLICY "Employees can view their own archives"
ON public.expense_archives FOR SELECT TO authenticated
USING (auth.uid() = employee_id AND public.is_active_user());


-- ==========================================================
-- 4. STORAGE SETUP (PROOFS BUCKET & ROBUST POLICIES)
-- ==========================================================

-- 1. Create the 'proofs' bucket inside storage.buckets schema if it doesn't exist
-- Note: Set 'public' to true so file links can be checked directly by admins
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('proofs', 'proofs', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Fully allow public select/view accesses on proofs bucket
CREATE POLICY "Allow public read access on proofs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'proofs');

-- 3. Allow employees/authenticated users to insert objects into their own user_id directory
CREATE POLICY "Allow employees to upload to proofs bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proofs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow users to delete their own uploaded files
CREATE POLICY "Allow employees to delete their own proofs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Allow admins full control over all files in the proofs bucket
CREATE POLICY "Allow admins full control on storage"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'proofs'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
  )
);

