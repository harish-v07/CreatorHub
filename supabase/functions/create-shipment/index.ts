import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getShiprocketToken(): Promise<string> {
    const email = Deno.env.get("SHIPROCKET_EMAIL");
    const password = Deno.env.get("SHIPROCKET_PASSWORD");

    if (!email || !password) throw new Error("Shiprocket credentials not configured");

    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) throw new Error(`Shiprocket auth failed: ${await res.text()}`);
    const data = await res.json();
    if (!data.token) throw new Error("No token in Shiprocket auth response");
    return data.token;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify calling user
        const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { order_id } = await req.json();
        if (!order_id) {
            return new Response(JSON.stringify({ error: "order_id is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Fetch all required data in one query
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select(`
        id,
        user_id,
        amount,
        delivery_address,
        product_id,
        products (
          id,
          name,
          type,
          price,
          creator_id,
          profiles (
            id,
            name,
            email,
            pickup_name,
            pickup_registered
          )
        ),
        profiles!orders_user_id_fkey (
          name,
          email
        )
      `)
            .eq("id", order_id)
            .single();

        if (orderError || !order) {
            console.error("Order fetch error:", orderError);
            return new Response(JSON.stringify({ error: "Order not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Only create shipments for physical products
        const product = order.products as any;
        if (!product || product.type !== "physical") {
            return new Response(
                JSON.stringify({ success: true, skipped: true, reason: "Not a physical product" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check seller has registered pickup
        const sellerProfile = product.profiles as any;
        if (!sellerProfile?.pickup_registered || !sellerProfile?.pickup_name) {
            return new Response(
                JSON.stringify({ error: "Seller has not registered a pickup address yet" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check delivery address exists
        const deliveryAddress = order.delivery_address as any;
        if (!deliveryAddress) {
            return new Response(
                JSON.stringify({ error: "No delivery address found on order" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const buyerProfile = order.profiles as any;

        // Authenticate with Shiprocket
        const token = await getShiprocketToken();

        // Build the Shiprocket order payload
        const orderDate = new Date().toISOString().split("T")[0]; // yyyy-mm-dd
        const shiprocketPayload = {
            order_id: `CH_${order_id.substring(0, 12)}`,
            order_date: orderDate,
            pickup_location: sellerProfile.pickup_name,
            billing_customer_name: deliveryAddress.fullName,
            billing_last_name: "",
            billing_address: deliveryAddress.addressLine,
            billing_address_2: "",
            billing_city: deliveryAddress.city,
            billing_pincode: deliveryAddress.pincode,
            billing_state: deliveryAddress.state,
            billing_country: "India",
            billing_email: buyerProfile?.email || "",
            billing_phone: deliveryAddress.phone,
            shipping_is_billing: true,
            order_items: [
                {
                    name: product.name,
                    sku: `SKU_${product.id.substring(0, 8)}`,
                    units: 1,
                    selling_price: String(order.amount),
                },
            ],
            payment_method: "Prepaid",
            sub_total: order.amount,
            length: 10,
            breadth: 10,
            height: 10,
            weight: 0.5,
        };

        const srRes = await fetch(
            "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(shiprocketPayload),
            }
        );

        const srData = await srRes.json();
        console.log("Shiprocket create order response:", srData);

        if (!srRes.ok) {
            await supabase.from("orders").update({ shipment_status: "failed" }).eq("id", order_id);
            return new Response(
                JSON.stringify({ error: srData?.message || "Shiprocket order creation failed" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Store shipment details
        const { error: shipmentError } = await supabase.from("shipments").insert({
            order_id: order_id,
            shiprocket_order_id: String(srData.order_id || ""),
            shiprocket_shipment_id: String(srData.shipment_id || ""),
            awb_code: srData.awb_code || null,
            courier_name: srData.courier_name || null,
            courier_company_id: srData.courier_company_id || null,
        });

        if (shipmentError) {
            console.error("Shipment insert error:", shipmentError);
        }

        // Update order shipment status
        await supabase
            .from("orders")
            .update({ shipment_status: "shipped" })
            .eq("id", order_id);

        return new Response(
            JSON.stringify({
                success: true,
                shiprocket_order_id: srData.order_id,
                awb_code: srData.awb_code,
                courier_name: srData.courier_name,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err: any) {
        console.error("create-shipment error:", err);
        return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
