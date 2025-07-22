const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    // Note: Supabase doesn't provide a direct SQL execution method via the JS client
    // You'll need to run this migration via the Supabase dashboard or CLI
    
    console.log('\n⚠️  Please run the following migration in your Supabase SQL editor:');
    console.log('https://supabase.com/dashboard/project/pahfsiosiuxdkiebepav/sql/new\n');
    console.log('Migration file: supabase/migrations/001_initial_schema.sql');
    console.log('\nOr use the Supabase CLI:');
    console.log('supabase db push');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runMigrations();