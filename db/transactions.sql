-- SQL transaction helper functions

-- Begin a transaction
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'BEGIN';
END;
$$;

-- Commit a transaction
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'COMMIT';
END;
$$;

-- Rollback a transaction
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'ROLLBACK';
END;
$$; 