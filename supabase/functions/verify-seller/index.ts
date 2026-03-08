import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Validate caller is admin
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Check admin role
        const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .single();

        if (!roleData || roleData.role !== "admin") {
            return new Response(JSON.stringify({ error: "Admin access required" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { userId, action, notes } = await req.json();

        if (!userId || !action) {
            return new Response(JSON.stringify({ error: "userId and action are required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── Fetch creator profile data ───────────────────────────────────────────
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, name, bio, social_links, verification_status")
            .eq("id", userId)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: "Profile not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Count products and courses
        const [{ count: productCount }, { count: courseCount }] = await Promise.all([
            supabase.from("products").select("id", { count: "exact", head: true }).eq("creator_id", userId),
            supabase.from("courses").select("id", { count: "exact", head: true }).eq("creator_id", userId),
        ]);

        // ─── ACTION: score ─────────────────────────────────────────────────────────
        if (action === "score") {
            const socialLinks = typeof profile.social_links === "object" && profile.social_links !== null
                ? profile.social_links as Record<string, string>
                : {};

            const socialCount = Object.values(socialLinks).filter((v) => v && v.trim() !== "").length;

            const prompt = `You are an expert marketplace trust & safety analyst. A seller has applied for verification on CreatorHub, an Indian online marketplace for digital creators selling courses and products.

Evaluate the following seller profile and provide a trust score and short reasoning:

Seller Name: ${profile.name || "Not provided"}
Bio: ${profile.bio || "No bio provided"}
Social Media Links Provided: ${socialCount} out of 3 (Instagram, Twitter, Website)
Total Products Listed: ${productCount || 0}
Total Courses Listed: ${courseCount || 0}

Scoring Criteria:
- Bio quality: Is it professional, detailed, genuine? (30 points)
- Social presence: More social links = more credibility (25 points)
- Content volume: Have they created actual products/courses? (25 points)
- Red flags: Vague/suspicious bio, no social links, no products (penalize up to -20 points)

Respond strictly in valid JSON format only, no markdown or extra text:
{
  "trust_score": <integer 0-100>,
  "recommendation": "<Approve | Reject | Review>",
  "reasoning": "<2-3 sentence explanation>",
  "red_flags": ["<flag1>", "<flag2>"] 
}

If there are no red flags, return an empty array for red_flags.`;

            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 512,
                        },
                    }),
                }
            );

            if (!geminiResponse.ok) {
                const errText = await geminiResponse.text();
                console.error("Gemini API error:", errText);
                return new Response(JSON.stringify({ error: "Gemini API call failed", details: errText }), {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const geminiData = await geminiResponse.json();
            const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // Parse JSON from Gemini response
            let scoreData: any = {};
            try {
                // Strip markdown code fences if present
                const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                scoreData = JSON.parse(cleaned);
            } catch (e) {
                console.error("Failed to parse Gemini response:", rawText);
                return new Response(
                    JSON.stringify({ error: "Failed to parse Gemini response", raw: rawText }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    profile: { name: profile.name, bio: profile.bio, socialCount, productCount, courseCount },
                    ai_score: scoreData,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ─── ACTION: approve ───────────────────────────────────────────────────────
        if (action === "approve") {
            const { error } = await supabase
                .from("profiles")
                .update({ is_verified: true, verification_status: "verified", verification_notes: null })
                .eq("id", userId);

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, message: "Seller approved and verified" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── ACTION: reject ────────────────────────────────────────────────────────
        if (action === "reject") {
            const { error } = await supabase
                .from("profiles")
                .update({
                    is_verified: false,
                    verification_status: "rejected",
                    verification_notes: notes || "Your verification request was rejected by an admin.",
                })
                .eq("id", userId);

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, message: "Seller verification rejected" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ error: "Unknown action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("verify-seller error:", err);
        return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
