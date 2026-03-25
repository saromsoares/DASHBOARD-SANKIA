const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ywwgicwqkfcxgxditpil.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_KEY) {
    console.warn('[Supabase] SUPABASE_SERVICE_KEY not set - database operations will fail');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
