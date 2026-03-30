-- Run this in the Supabase SQL Editor

CREATE TABLE licenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key text UNIQUE NOT NULL,
  customer_name text,
  device_id text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  activated_at timestamp with time zone
);

-- Turn on Row Level Security (RLS)
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read a license by exact key (for client verification)
-- Note: Supabase JS clients will need to query `.eq('license_key')`
CREATE POLICY "Allow public read" 
ON licenses FOR SELECT 
USING (true);

-- Policy: Clients can only UPDATE the device_id if it is currently NULL (first-time activation)
CREATE POLICY "Allow device binding" 
ON licenses FOR UPDATE 
USING (device_id IS NULL) 
WITH CHECK (device_id IS NOT NULL);

-- Policy: Admins (authenticated users) can do everything
CREATE POLICY "Admins bypass RLS"
ON licenses FOR ALL
USING (auth.role() = 'authenticated');
