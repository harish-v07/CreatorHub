const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProduct() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', 'e8e31e40-71aa-4901-af80-e9957f737977')
    .single();
    
  if (error) console.error("Error:", error);
  else console.log("Product:", JSON.stringify(data, null, 2));
}

checkProduct();
