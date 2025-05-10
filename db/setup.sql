-- Create custom roles enum type
CREATE TYPE user_role AS ENUM ('user', 'manager', 'admin');

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_email TEXT,
  notification_email_password TEXT
);

-- Create mailrooms table
CREATE TABLE IF NOT EXISTS public.mailrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_email TEXT
);

-- Create profiles table with organization and mailroom references
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'user',
  organization_id UUID REFERENCES public.organizations(id),
  mailroom_id UUID REFERENCES public.mailrooms(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create invitations table to track pending invites
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mailroom_id UUID NOT NULL REFERENCES public.mailrooms(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used BOOLEAN NOT NULL DEFAULT false
);

-- Create an automatic trigger to create a profile when a new user signs up 
-- We'll keep this for non-invite signups (e.g., first admin)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle user signup from invitation
CREATE OR REPLACE FUNCTION public.handle_invited_user_signup() 
RETURNS TRIGGER AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Look for an invitation with matching email
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE email = NEW.email
  AND used = false
  AND expires_at > NOW()
  LIMIT 1;
  
  -- If invitation found, create profile with org and mailroom from invitation
  IF invitation_record.id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id, 
      role, 
      organization_id, 
      mailroom_id
    ) VALUES (
      NEW.id, 
      invitation_record.role, 
      invitation_record.organization_id, 
      invitation_record.mailroom_id
    );
    
    -- Mark invitation as used
    UPDATE public.invitations 
    SET used = true 
    WHERE id = invitation_record.id;
  ELSE
    -- Fall back to default profile creation if no invitation
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the basic trigger with our new invitation-aware trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_invited_user_signup();

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers for all tables
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_mailrooms_updated_at
  BEFORE UPDATE ON public.mailrooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create access policies for profiles

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can view profiles in their organization
CREATE POLICY "Users can view profiles in same organization" ON public.profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Only admins can update roles
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can update their own profile (except role, org, and mailroom)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    OLD.role = NEW.role AND
    OLD.organization_id = NEW.organization_id AND
    OLD.mailroom_id = NEW.mailroom_id
  );

-- Policies for organizations

-- Everyone can view organizations
CREATE POLICY "Anyone can view organizations" ON public.organizations
  FOR SELECT
  USING (true);

-- Only admins can create/update organizations
CREATE POLICY "Admins can manage organizations" ON public.organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies for mailrooms

-- Users can view mailrooms in their organization
CREATE POLICY "Users can view mailrooms in their organization" ON public.mailrooms
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Admins and managers can create/update mailrooms
CREATE POLICY "Admins and managers can manage mailrooms" ON public.mailrooms
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    )
  );

-- Policies for invitations

-- Managers and admins can create invitations
CREATE POLICY "Managers and admins can create invitations" ON public.invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    )
  );

-- Users can view invitations they created
CREATE POLICY "Users can view invitations they created" ON public.invitations
  FOR SELECT
  USING (invited_by = auth.uid());

-- Users can view invitations for their org/mailroom if they are manager+
CREATE POLICY "Managers and admins can view org invitations" ON public.invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'manager')
      AND organization_id = invitations.organization_id
    )
  );

-- Only the inviter or an admin can update/delete an invitation
CREATE POLICY "Users can manage their own invitations" ON public.invitations
  FOR ALL
  USING (
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  ); 