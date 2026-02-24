import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

        const key_secret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        // Correct way to use crypto in Deno for HMAC SHA256 matches node's crypto
        const hmac = createHmac('sha256', key_secret);
        hmac.update(body);
        const generated_signature = hmac.digest('hex');

        if (generated_signature === razorpay_signature) {
            JSON.stringify({ success: true, message: "Payment verified successfully" }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );

// ─────────────────────────────────────────────────────────────
// Update transfer status in Supabase
// ─────────────────────────────────────────────────────────────
try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.3");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
        .from('payment_transfers')
        .update({
            status: 'completed',
            razorpay_payment_id: razorpay_payment_id,
            completed_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', razorpay_order_id);

    if (updateError) {
        console.error('Failed to update payment transfer status:', updateError);
    } else {
        console.log('Payment transfer marked as completed for order:', razorpay_order_id);
    }
} catch (err) {
    console.error('Error updating transfer status:', err);
}

return new Response(
    JSON.stringify({ success: true, message: "Payment verified successfully" }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
        } else {
    throw new Error("Invalid signature");
}
    } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
        JSON.stringify({ error: error.message, success: false }),
        {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    );
}
});
