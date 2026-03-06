// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://xneatcyqjeugveolfifj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZWF0Y3lxamV1Z3Zlb2xmaWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTYwMDAsImV4cCI6MjA4ODA3MjAwMH0.ZxZcFGJhpgANN20vI18WubmziuP-cbF-WVipte9eT98';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
