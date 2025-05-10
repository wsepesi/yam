-- Create custom package status enum type
CREATE TYPE package_status AS ENUM ('WAITING', 'RETRIEVED', 'STAFF_RESOLVED', 'STAFF_REMOVED');

-- Create residents table
CREATE TABLE IF NOT EXISTS public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailroom_id UUID NOT NULL REFERENCES public.mailrooms(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create packages table
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailroom_id UUID NOT NULL REFERENCES public.mailrooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staff_id UUID NOT NULL REFERENCES auth.users(id),
  pickup_staff_id UUID REFERENCES auth.users(id),
  resident_id UUID NOT NULL REFERENCES public.residents(id),
  status package_status NOT NULL DEFAULT 'WAITING',
  provider TEXT NOT NULL,
  package_id INT NOT NULL CHECK (package_id BETWEEN 1 AND 999),
  retrieved_timestamp TIMESTAMPTZ
);

-- Add updated_at triggers for new tables
CREATE TRIGGER set_residents_updated_at
  BEFORE UPDATE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create index for frequently queried fields
CREATE INDEX idx_residents_mailroom ON public.residents(mailroom_id);
CREATE INDEX idx_residents_student_id ON public.residents(student_id);
CREATE INDEX idx_packages_mailroom ON public.packages(mailroom_id);
CREATE INDEX idx_packages_resident ON public.packages(resident_id);
CREATE INDEX idx_packages_status ON public.packages(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for residents

-- Users can view residents in their mailroom
CREATE POLICY "Users can view residents in their mailroom" ON public.residents
  FOR SELECT
  USING (
    mailroom_id IN (
      SELECT mailroom_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Managers and admins can manage residents
CREATE POLICY "Managers and admins can manage residents" ON public.residents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'manager')
      AND mailroom_id = residents.mailroom_id
    )
  );

-- RLS Policies for packages

-- Users can view packages in their mailroom
CREATE POLICY "Users can view packages in their mailroom" ON public.packages
  FOR SELECT
  USING (
    mailroom_id IN (
      SELECT mailroom_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- All authenticated users can create packages in their mailroom
CREATE POLICY "Users can create packages in their mailroom" ON public.packages
  FOR INSERT
  WITH CHECK (
    mailroom_id IN (
      SELECT mailroom_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Users can update packages they created
CREATE POLICY "Users can update packages they created" ON public.packages
  FOR UPDATE
  USING (staff_id = auth.uid());

-- Managers and admins can update any package in their mailroom
CREATE POLICY "Managers and admins can update any package in their mailroom" ON public.packages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'manager')
      AND mailroom_id = packages.mailroom_id
    )
  );

-- Add status change trigger for packages
CREATE OR REPLACE FUNCTION public.handle_package_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changing to RETRIEVED, set retrieved_timestamp
  IF NEW.status = 'RETRIEVED' AND OLD.status != 'RETRIEVED' THEN
    NEW.retrieved_timestamp = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_package_status_change
  BEFORE UPDATE ON public.packages
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_package_status_change(); 