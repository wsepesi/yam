

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."invitation_status" AS ENUM (
    'PENDING',
    'RESOLVED',
    'FAILED'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."mailroom_status" AS ENUM (
    'ACTIVE',
    'DEFUNCT',
    'DEMO'
);


ALTER TYPE "public"."mailroom_status" OWNER TO "postgres";


CREATE TYPE "public"."org_status" AS ENUM (
    'ACTIVE',
    'DEFUNCT',
    'DEMO'
);


ALTER TYPE "public"."org_status" OWNER TO "postgres";


CREATE TYPE "public"."package_status" AS ENUM (
    'WAITING',
    'RETRIEVED',
    'STAFF_RESOLVED',
    'STAFF_REMOVED'
);


ALTER TYPE "public"."package_status" OWNER TO "postgres";


CREATE TYPE "public"."pickup_search_options" AS ENUM (
    'resident_id',
    'resident_name'
);


ALTER TYPE "public"."pickup_search_options" OWNER TO "postgres";


CREATE TYPE "public"."resident_status" AS ENUM (
    'ACTIVE',
    'REMOVED_BULK',
    'REMOVED_INDIVIDUAL',
    'ADMIN_ACTION'
);


ALTER TYPE "public"."resident_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'manager',
    'admin',
    'super-admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."begin_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  EXECUTE 'BEGIN';
END;
$$;


ALTER FUNCTION "public"."begin_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commit_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  EXECUTE 'COMMIT';
END;
$$;


ALTER FUNCTION "public"."commit_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mailroom_name_by_slug"("mailroom_slug_param" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT name
    FROM public.mailrooms -- Ensure 'public.mailrooms' is your correct table
    WHERE slug = mailroom_slug_param
    LIMIT 1
  );
END;
$$;


ALTER FUNCTION "public"."get_mailroom_name_by_slug"("mailroom_slug_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mailroom_slug_by_id"("mailroom_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT slug
    FROM public.mailrooms -- Ensure 'public.mailrooms' is your correct table
    WHERE id = mailroom_id_param
    LIMIT 1
  );
END;
$$;


ALTER FUNCTION "public"."get_mailroom_slug_by_id"("mailroom_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_package_stats_for_mailroom"("p_mailroom_id" "uuid") RETURNS TABLE("month_name" "text", "package_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH month_series AS (
    SELECT date_trunc('month', CURRENT_DATE - (s.i || ' months')::interval) AS month_start
    FROM generate_series(5, 0, -1) AS s(i) -- 5 months ago, 4, ..., current month
  )
  SELECT
    to_char(ms.month_start, 'Mon') AS month_name, -- 'Jan', 'Feb', etc.
    COALESCE(COUNT(p.id), 0) AS package_count
  FROM month_series ms
  LEFT JOIN packages p
    ON p.mailroom_id = p_mailroom_id AND date_trunc('month', p.created_at) = ms.month_start
  GROUP BY ms.month_start
  ORDER BY ms.month_start ASC;
END;
$$;


ALTER FUNCTION "public"."get_monthly_package_stats_for_mailroom"("p_mailroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_package_number"("p_mailroom_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_id INTEGER;
BEGIN
    -- Begin transaction for atomic operation
    BEGIN
        -- Get the oldest available package number
        SELECT package_number INTO next_id 
        FROM package_ids 
        WHERE mailroom_id = p_mailroom_id AND is_available = TRUE 
        ORDER BY last_used_at ASC  -- Oldest timestamp first
        LIMIT 1
        FOR UPDATE;  -- Lock row to prevent race conditions
        
        -- If we found one, mark it as unavailable
        IF next_id IS NOT NULL THEN
            UPDATE package_ids 
            SET is_available = FALSE, last_used_at = NOW() 
            WHERE mailroom_id = p_mailroom_id AND package_number = next_id;
            
            RAISE NOTICE 'Assigned package number % for mailroom %', next_id, p_mailroom_id;
        ELSE
            RAISE WARNING 'No available package numbers for mailroom %', p_mailroom_id;
        END IF;
        
        RETURN next_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error getting package number: %', SQLERRM;
        RETURN NULL;
    END;
END;
$$;


ALTER FUNCTION "public"."get_next_package_number"("p_mailroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organization_name_by_slug"("org_slug_param" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT name
    FROM public.organizations -- Ensure 'public.organizations' is your correct table
    WHERE slug = org_slug_param
    LIMIT 1
  );
END;
$$;


ALTER FUNCTION "public"."get_organization_name_by_slug"("org_slug_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organization_slug_by_id"("org_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT slug
    FROM public.organizations -- Ensure 'public.organizations' is your correct table
    WHERE id = org_id_param
    LIMIT 1
  );
END;
$$;


ALTER FUNCTION "public"."get_organization_slug_by_id"("org_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_queue_stats"("p_mailroom_id" "uuid") RETURNS TABLE("total_numbers" integer, "available_numbers" integer, "in_use_numbers" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER AS total_numbers,
        SUM(CASE WHEN is_available = TRUE THEN 1 ELSE 0 END)::INTEGER AS available_numbers,
        SUM(CASE WHEN is_available = FALSE THEN 1 ELSE 0 END)::INTEGER AS in_use_numbers
    FROM package_ids
    WHERE mailroom_id = p_mailroom_id;
END;
$$;


ALTER FUNCTION "public"."get_queue_stats"("p_mailroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_org_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    org_id uuid;
BEGIN
    SELECT organization_id INTO org_id 
    FROM profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
    
    RETURN org_id;
END;
$$;


ALTER FUNCTION "public"."get_user_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_failed_package_resolution"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If being marked as resolved, set resolved_at timestamp
  IF NEW.resolved = TRUE AND OLD.resolved = FALSE THEN
    NEW.resolved_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_failed_package_resolution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_invited_user_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
  
  -- If invitation found, create profile with org, mailroom and email from invitation
  IF invitation_record.id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id, 
      role, 
      organization_id, 
      mailroom_id,
      email
    ) VALUES (
      NEW.id, 
      invitation_record.role, 
      invitation_record.organization_id, 
      invitation_record.mailroom_id,
      NEW.email
    );
    
    -- Mark invitation as used
    UPDATE public.invitations 
    SET used = true 
    WHERE id = invitation_record.id;
  ELSE
    -- Fall back to default profile creation if no invitation
    INSERT INTO public.profiles (id, role, email)
    VALUES (NEW.id, 'user', NEW.email);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_invited_user_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, role, email)
  VALUES (new.id, 'user', new.email);
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_package_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If status changing to RETRIEVED, set retrieved_timestamp
  IF NEW.status = 'RETRIEVED' AND OLD.status != 'RETRIEVED' THEN
    NEW.retrieved_timestamp = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_package_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_package_queue"("p_mailroom_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    i INTEGER;
BEGIN
    -- Check if queue already exists for this mailroom
    IF EXISTS (SELECT 1 FROM package_ids WHERE mailroom_id = p_mailroom_id LIMIT 1) THEN
        RAISE NOTICE 'Queue for mailroom % already exists. Skipping initialization.', p_mailroom_id;
        RETURN;
    END IF;
    
    -- Insert package numbers 1-999 with random timestamps to shuffle initial order
    FOR i IN 1..999 LOOP
        INSERT INTO package_ids (
            mailroom_id, 
            package_number, 
            is_available, 
            last_used_at
        ) VALUES (
            p_mailroom_id, 
            i, 
            TRUE, 
            NOW() - (random() * INTERVAL '90 days')  -- Random timestamp within past 90 days
        );
    END LOOP;
    
    RAISE NOTICE 'Successfully initialized queue for mailroom % with 999 shuffled package numbers', p_mailroom_id;
END;
$$;


ALTER FUNCTION "public"."initialize_package_queue"("p_mailroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    admin_status boolean;
BEGIN
    SELECT (role = 'admin') INTO admin_status 
    FROM profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
    
    RETURN COALESCE(admin_status, false);
END;
$$;


ALTER FUNCTION "public"."is_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_package_number"("p_mailroom_id" "uuid", "p_package_number" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    success BOOLEAN := FALSE;
BEGIN
    -- Begin transaction for atomic operation
    BEGIN
        -- Mark the package number as available and update timestamp
        -- The updated timestamp ensures it goes to the back of the queue
        UPDATE package_ids 
        SET is_available = TRUE, last_used_at = NOW() 
        WHERE mailroom_id = p_mailroom_id AND package_number = p_package_number;
        
        IF FOUND THEN
            RAISE NOTICE 'Released package number % back to mailroom % queue', p_package_number, p_mailroom_id;
            success := TRUE;
        ELSE
            RAISE WARNING 'Package number % not found in mailroom %', p_package_number, p_mailroom_id;
        END IF;
        
        RETURN success;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error releasing package number: %', SQLERRM;
        RETURN FALSE;
    END;
END;
$$;


ALTER FUNCTION "public"."release_package_number"("p_mailroom_id" "uuid", "p_package_number" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollback_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  EXECUTE 'ROLLBACK';
END;
$$;


ALTER FUNCTION "public"."rollback_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."failed_package_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mailroom_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "resident_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "error_details" "text",
    "resolved" boolean DEFAULT false NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."failed_package_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "mailroom_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used" boolean DEFAULT false NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'PENDING'::"public"."invitation_status" NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mailrooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "admin_email" "text",
    "slug" "text" DEFAULT 'a'::"text" NOT NULL,
    "mailroom_hours" "jsonb",
    "email_additional_text" "text",
    "status" "public"."mailroom_status" DEFAULT 'ACTIVE'::"public"."mailroom_status" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "pickup_option" "public"."pickup_search_options" DEFAULT 'resident_id'::"public"."pickup_search_options" NOT NULL
);


ALTER TABLE "public"."mailrooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_email" "text",
    "notification_email_password" "text",
    "slug" "text" DEFAULT 'a'::"text" NOT NULL,
    "status" "public"."org_status" DEFAULT 'ACTIVE'::"public"."org_status" NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_ids" (
    "mailroom_id" "uuid" NOT NULL,
    "package_number" integer NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    CONSTRAINT "package_ids_package_number_check" CHECK ((("package_number" >= 1) AND ("package_number" <= 999)))
);


ALTER TABLE "public"."package_ids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mailroom_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "resident_id" "uuid" NOT NULL,
    "status" "public"."package_status" DEFAULT 'WAITING'::"public"."package_status" NOT NULL,
    "provider" "text" NOT NULL,
    "package_id" integer NOT NULL,
    "retrieved_timestamp" timestamp with time zone,
    "pickup_staff_id" "uuid",
    CONSTRAINT "packages_package_id_check" CHECK ((("package_id" >= 1) AND ("package_id" <= 999)))
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "organization_id" "uuid",
    "mailroom_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "status" "text" DEFAULT 'INVITED'::"text",
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['INVITED'::"text", 'ACTIVE'::"text", 'REMOVED'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."residents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mailroom_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "student_id" "text" NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "added_by" "uuid" NOT NULL,
    "status" "public"."resident_status" DEFAULT 'ACTIVE'::"public"."resident_status" NOT NULL
);


ALTER TABLE "public"."residents" OWNER TO "postgres";


ALTER TABLE ONLY "public"."failed_package_logs"
    ADD CONSTRAINT "failed_package_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mailrooms"
    ADD CONSTRAINT "mailrooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mailrooms"
    ADD CONSTRAINT "mailrooms_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."package_ids"
    ADD CONSTRAINT "package_ids_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."package_ids"
    ADD CONSTRAINT "package_ids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."residents"
    ADD CONSTRAINT "residents_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_failed_logs_mailroom" ON "public"."failed_package_logs" USING "btree" ("mailroom_id");



CREATE INDEX "idx_failed_logs_resolved" ON "public"."failed_package_logs" USING "btree" ("resolved");



CREATE INDEX "idx_package_ids_queue" ON "public"."package_ids" USING "btree" ("mailroom_id", "is_available", "last_used_at");



CREATE INDEX "idx_packages_mailroom" ON "public"."packages" USING "btree" ("mailroom_id");



CREATE INDEX "idx_packages_resident" ON "public"."packages" USING "btree" ("resident_id");



CREATE INDEX "idx_packages_status" ON "public"."packages" USING "btree" ("status");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_residents_mailroom" ON "public"."residents" USING "btree" ("mailroom_id");



CREATE INDEX "idx_residents_student_id" ON "public"."residents" USING "btree" ("student_id");



CREATE OR REPLACE TRIGGER "on_failed_package_resolved" BEFORE UPDATE ON "public"."failed_package_logs" FOR EACH ROW WHEN (("old"."resolved" IS DISTINCT FROM "new"."resolved")) EXECUTE FUNCTION "public"."handle_failed_package_resolution"();



CREATE OR REPLACE TRIGGER "on_package_status_change" BEFORE UPDATE ON "public"."packages" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."handle_package_status_change"();



CREATE OR REPLACE TRIGGER "set_failed_package_logs_updated_at" BEFORE UPDATE ON "public"."failed_package_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_invitations_updated_at" BEFORE UPDATE ON "public"."invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_mailrooms_updated_at" BEFORE UPDATE ON "public"."mailrooms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_packages_updated_at" BEFORE UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_residents_updated_at" BEFORE UPDATE ON "public"."residents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."failed_package_logs"
    ADD CONSTRAINT "failed_package_logs_mailroom_id_fkey" FOREIGN KEY ("mailroom_id") REFERENCES "public"."mailrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."failed_package_logs"
    ADD CONSTRAINT "failed_package_logs_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."failed_package_logs"
    ADD CONSTRAINT "failed_package_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_mailroom_id_fkey" FOREIGN KEY ("mailroom_id") REFERENCES "public"."mailrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mailrooms"
    ADD CONSTRAINT "mailrooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."mailrooms"
    ADD CONSTRAINT "mailrooms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_mailroom_id_fkey" FOREIGN KEY ("mailroom_id") REFERENCES "public"."mailrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pickup_staff_id_fkey" FOREIGN KEY ("pickup_staff_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_mailroom_id_fkey" FOREIGN KEY ("mailroom_id") REFERENCES "public"."mailrooms"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."residents"
    ADD CONSTRAINT "residents_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."residents"
    ADD CONSTRAINT "residents_mailroom_id_fkey" FOREIGN KEY ("mailroom_id") REFERENCES "public"."mailrooms"("id") ON DELETE CASCADE;



CREATE POLICY "Enable read access for all users" ON "public"."invitations" FOR SELECT USING (true);



CREATE POLICY "Enable update access for all users" ON "public"."invitations" FOR UPDATE USING (true);



CREATE POLICY "Managers and admins can manage residents" ON "public"."residents" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'admin'::"public"."user_role") OR ("profiles"."role" = 'manager'::"public"."user_role")) AND ("profiles"."mailroom_id" = "residents"."mailroom_id")))));



CREATE POLICY "Managers and admins can update any package in their mailroom" ON "public"."packages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'admin'::"public"."user_role") OR ("profiles"."role" = 'manager'::"public"."user_role")) AND ("profiles"."mailroom_id" = "packages"."mailroom_id")))));



CREATE POLICY "Managers and admins can update failures" ON "public"."failed_package_logs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'admin'::"public"."user_role") OR ("profiles"."role" = 'manager'::"public"."user_role")) AND ("profiles"."mailroom_id" = "failed_package_logs"."mailroom_id")))));



CREATE POLICY "Users can create failure logs in their mailroom" ON "public"."failed_package_logs" FOR INSERT WITH CHECK (("mailroom_id" IN ( SELECT "profiles"."mailroom_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can create packages in their mailroom" ON "public"."packages" FOR INSERT WITH CHECK (("mailroom_id" IN ( SELECT "profiles"."mailroom_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update packages they created" ON "public"."packages" FOR UPDATE USING (("staff_id" = "auth"."uid"()));



CREATE POLICY "Users can view failures in their mailroom" ON "public"."failed_package_logs" FOR SELECT USING (("mailroom_id" IN ( SELECT "profiles"."mailroom_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view packages in their mailroom" ON "public"."packages" FOR SELECT USING (("mailroom_id" IN ( SELECT "profiles"."mailroom_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view residents in their mailroom" ON "public"."residents" FOR SELECT USING (("mailroom_id" IN ( SELECT "profiles"."mailroom_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."failed_package_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mailrooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mailrooms_admin_all" ON "public"."mailrooms" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_user_admin"());



CREATE POLICY "mailrooms_admin_delete" ON "public"."mailrooms" FOR DELETE TO "authenticated" USING ("public"."is_user_admin"());



CREATE POLICY "mailrooms_admin_update" ON "public"."mailrooms" FOR UPDATE TO "authenticated" USING ("public"."is_user_admin"());



CREATE POLICY "mailrooms_org_select" ON "public"."mailrooms" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_org_id"()));



CREATE POLICY "mailrooms_public_select" ON "public"."mailrooms" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_admin_all" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_user_admin"());



CREATE POLICY "organizations_admin_delete" ON "public"."organizations" FOR DELETE TO "authenticated" USING ("public"."is_user_admin"());



CREATE POLICY "organizations_admin_update" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ("public"."is_user_admin"());



CREATE POLICY "organizations_public_select" ON "public"."organizations" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."package_ids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_all" ON "public"."profiles" TO "authenticated" USING ("public"."is_user_admin"());



CREATE POLICY "profiles_same_org_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_user_org_id"()));



CREATE POLICY "profiles_self_access" ON "public"."profiles" TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."residents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_policy" ON "public"."package_ids" FOR SELECT USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mailroom_name_by_slug"("mailroom_slug_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_mailroom_name_by_slug"("mailroom_slug_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mailroom_name_by_slug"("mailroom_slug_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mailroom_slug_by_id"("mailroom_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_mailroom_slug_by_id"("mailroom_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mailroom_slug_by_id"("mailroom_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_package_stats_for_mailroom"("p_mailroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_package_stats_for_mailroom"("p_mailroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_package_stats_for_mailroom"("p_mailroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_package_number"("p_mailroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_package_number"("p_mailroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_package_number"("p_mailroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organization_name_by_slug"("org_slug_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_name_by_slug"("org_slug_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_name_by_slug"("org_slug_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organization_slug_by_id"("org_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_slug_by_id"("org_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_slug_by_id"("org_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_queue_stats"("p_mailroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_queue_stats"("p_mailroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_queue_stats"("p_mailroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_failed_package_resolution"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_failed_package_resolution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_failed_package_resolution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_invited_user_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_invited_user_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_invited_user_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_package_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_package_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_package_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_package_queue"("p_mailroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_package_queue"("p_mailroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_package_queue"("p_mailroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."release_package_number"("p_mailroom_id" "uuid", "p_package_number" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."release_package_number"("p_mailroom_id" "uuid", "p_package_number" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_package_number"("p_mailroom_id" "uuid", "p_package_number" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."failed_package_logs" TO "anon";
GRANT ALL ON TABLE "public"."failed_package_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."failed_package_logs" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."mailrooms" TO "anon";
GRANT ALL ON TABLE "public"."mailrooms" TO "authenticated";
GRANT ALL ON TABLE "public"."mailrooms" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."package_ids" TO "anon";
GRANT ALL ON TABLE "public"."package_ids" TO "authenticated";
GRANT ALL ON TABLE "public"."package_ids" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."residents" TO "anon";
GRANT ALL ON TABLE "public"."residents" TO "authenticated";
GRANT ALL ON TABLE "public"."residents" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
