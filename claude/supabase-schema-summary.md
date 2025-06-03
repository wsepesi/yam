-- COMPACTED DATABASE SCHEMA FOR CLAUDE CODE

-- ENUMS
CREATE TYPE invitation_status AS ENUM ('PENDING', 'RESOLVED', 'FAILED');
CREATE TYPE mailroom_status AS ENUM ('ACTIVE', 'DEFUNCT', 'DEMO');
CREATE TYPE org_status AS ENUM ('ACTIVE', 'DEFUNCT', 'DEMO');
CREATE TYPE package_status AS ENUM ('WAITING', 'RETRIEVED', 'STAFF_RESOLVED', 'STAFF_REMOVED');
CREATE TYPE pickup_search_options AS ENUM ('resident_id', 'resident_name');
CREATE TYPE resident_status AS ENUM ('ACTIVE', 'REMOVED_BULK', 'REMOVED_INDIVIDUAL', 'ADMIN_ACTION');
CREATE TYPE user_role AS ENUM ('user', 'manager', 'admin', 'super-admin');

-- CORE TABLES
CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL DEFAULT 'a',
    status org_status DEFAULT 'ACTIVE',
    notification_email text,
    notification_email_password text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE mailrooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL DEFAULT 'a',
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status mailroom_status DEFAULT 'ACTIVE',
    admin_email text,
    mailroom_hours jsonb,
    email_additional_text text,
    pickup_option pickup_search_options DEFAULT 'resident_id',
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'user',
    organization_id uuid REFERENCES organizations(id),
    mailroom_id uuid REFERENCES mailrooms(id),
    email text,
    status text DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'REMOVED')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE residents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mailroom_id uuid NOT NULL REFERENCES mailrooms(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    student_id text NOT NULL,
    email text,
    status resident_status DEFAULT 'ACTIVE',
    added_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE package_ids (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mailroom_id uuid NOT NULL,
    package_number integer NOT NULL CHECK (package_number >= 1 AND package_number <= 999),
    is_available boolean DEFAULT true,
    last_used_at timestamptz DEFAULT now()
);

CREATE TABLE packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mailroom_id uuid NOT NULL REFERENCES mailrooms(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES auth.users(id),
    resident_id uuid NOT NULL REFERENCES residents(id),
    package_id integer NOT NULL CHECK (package_id >= 1 AND package_id <= 999),
    status package_status DEFAULT 'WAITING',
    provider text NOT NULL,
    retrieved_timestamp timestamptz,
    pickup_staff_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    role user_role DEFAULT 'user',
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    mailroom_id uuid NOT NULL REFERENCES mailrooms(id) ON DELETE CASCADE,
    invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    used boolean DEFAULT false,
    status invitation_status DEFAULT 'PENDING',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE failed_package_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mailroom_id uuid NOT NULL REFERENCES mailrooms(id) ON DELETE CASCADE,
    staff_id uuid NOT NULL REFERENCES auth.users(id),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    resident_id text NOT NULL,
    provider text NOT NULL,
    error_details text,
    resolved boolean DEFAULT false,
    resolved_by uuid REFERENCES auth.users(id),
    resolved_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- KEY FUNCTIONS
-- Get next available package number
CREATE OR REPLACE FUNCTION get_next_package_number(p_mailroom_id uuid) 
RETURNS integer AS $$
DECLARE next_id INTEGER;
BEGIN
    SELECT package_number INTO next_id 
    FROM package_ids 
    WHERE mailroom_id = p_mailroom_id AND is_available = TRUE 
    ORDER BY last_used_at ASC LIMIT 1 FOR UPDATE;
    
    IF next_id IS NOT NULL THEN
        UPDATE package_ids 
        SET is_available = FALSE, last_used_at = NOW() 
        WHERE mailroom_id = p_mailroom_id AND package_number = next_id;
    END IF;
    
    RETURN next_id;
END;
$$ LANGUAGE plpgsql;

-- Release package number back to queue
CREATE OR REPLACE FUNCTION release_package_number(p_mailroom_id uuid, p_package_number integer) 
RETURNS boolean AS $$
BEGIN
    UPDATE package_ids 
    SET is_available = TRUE, last_used_at = NOW() 
    WHERE mailroom_id = p_mailroom_id AND package_number = p_package_number;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Initialize package queue (1-999)
CREATE OR REPLACE FUNCTION initialize_package_queue(p_mailroom_id uuid) 
RETURNS void AS $$
DECLARE i INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM package_ids WHERE mailroom_id = p_mailroom_id LIMIT 1) THEN
        RETURN;
    END IF;
    
    FOR i IN 1..999 LOOP
        INSERT INTO package_ids (mailroom_id, package_number, is_available, last_used_at) 
        VALUES (p_mailroom_id, i, TRUE, NOW() - (random() * INTERVAL '90 days'));
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Get monthly package stats
CREATE OR REPLACE FUNCTION get_monthly_package_stats_for_mailroom(p_mailroom_id uuid) 
RETURNS TABLE(month_name text, package_count bigint) AS $$
BEGIN
    RETURN QUERY
    WITH month_series AS (
        SELECT date_trunc('month', CURRENT_DATE - (s.i || ' months')::interval) AS month_start
        FROM generate_series(5, 0, -1) AS s(i)
    )
    SELECT to_char(ms.month_start, 'Mon') AS month_name,
           COALESCE(COUNT(p.id), 0) AS package_count
    FROM month_series ms
    LEFT JOIN packages p ON p.mailroom_id = p_mailroom_id 
                        AND date_trunc('month', p.created_at) = ms.month_start
    GROUP BY ms.month_start
    ORDER BY ms.month_start ASC;
END;
$$ LANGUAGE plpgsql;

-- Helper functions for auth/permissions
CREATE OR REPLACE FUNCTION get_user_org_id() RETURNS uuid AS $$
BEGIN
    RETURN (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_user_admin() RETURNS boolean AS $$
BEGIN
    RETURN COALESCE((SELECT role = 'admin' FROM profiles WHERE id = auth.uid() LIMIT 1), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- KEY INDEXES
CREATE INDEX idx_packages_mailroom ON packages(mailroom_id);
CREATE INDEX idx_packages_resident ON packages(resident_id);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_residents_mailroom ON residents(mailroom_id);
CREATE INDEX idx_residents_student_id ON residents(student_id);
CREATE INDEX idx_package_ids_queue ON package_ids(mailroom_id, is_available, last_used_at);

-- NOTES:
-- This system manages package delivery for organizations with multiple mailrooms
-- Each mailroom has residents (students) who receive packages
-- Package numbers (1-999) are assigned from a queue and recycled
-- RLS policies control access (users see only their mailroom's data)
-- Package workflow: WAITING -> RETRIEVED -> STAFF_RESOLVED/STAFF_REMOVED