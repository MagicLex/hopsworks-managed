  SELECT id, email,
    CASE
      WHEN metadata IS NOT NULL THEN jsonb_pretty(metadata)
      ELSE 'null'
    END as metadata
  FROM public.users
  LIMIT 10;

  Also let's check if there's any hopsworks-related data stored somewhere else:

  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name LIKE '%hopsworks%'
  ORDER BY column_name;