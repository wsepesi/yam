-- package_queue.sql
-- Implementation of package number queue system for mailrooms

-- Create the package_ids table to manage the queue
CREATE TABLE package_ids (
    mailroom_id UUID NOT NULL,
    package_number INTEGER NOT NULL CHECK (package_number BETWEEN 1 AND 999),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (mailroom_id, package_number)
);

-- Create index for efficient queue operations
CREATE INDEX idx_package_ids_queue ON package_ids(mailroom_id, is_available, last_used_at);

-- Function to initialize the queue for a mailroom with shuffled numbers
CREATE OR REPLACE FUNCTION initialize_package_queue(p_mailroom_id UUID)
RETURNS VOID 
LANGUAGE plpgsql
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

-- Function to get next available package number from queue
CREATE OR REPLACE FUNCTION get_next_package_number(p_mailroom_id UUID)
RETURNS INTEGER 
LANGUAGE plpgsql
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

-- Function to release a package number back to the queue
CREATE OR REPLACE FUNCTION release_package_number(p_mailroom_id UUID, p_package_number INTEGER)
RETURNS BOOLEAN 
LANGUAGE plpgsql
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

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats(p_mailroom_id UUID)
RETURNS TABLE (
    total_numbers INTEGER,
    available_numbers INTEGER,
    in_use_numbers INTEGER
) 
LANGUAGE plpgsql
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

SELECT initialize_package_queue('fd0dfba0-1388-4a01-b248-9fadbc50bbec');  -- Initialize queue for mailroom
-- SELECT get_next_package_number('fd0dfba0-1388-4a01-b248-9fadbc50bbec');   -- Get next available package number
-- SELECT release_package_number('fd0dfba0-1388-4a01-b248-9fadbc50bbec', 42); -- Release package #42 back to queue
SELECT * FROM get_queue_stats('fd0dfba0-1388-4a01-b248-9fadbc50bbec');    -- Get queue statistics