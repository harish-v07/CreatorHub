import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

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

        // AWS config
        const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
        const awsAccessKey = Deno.env.get("AWS_ACCESS_KEY_ID") || "";
        const awsSecretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY") || "";
        const s3Bucket = Deno.env.get("AWS_S3_BUCKET_NAME") || "";

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

        // ─── Fetch creator KYC data ───────────────────────────────────────────
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, name, kyc_selfie_url, kyc_document_url, kyc_document_type, kyc_full_name, kyc_mobile, kyc_address, kyc_id_number, verification_status")
            .eq("id", userId)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: "Profile not found", details: profileError?.message }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── ACTION: score ─────────────────────────────────────────────────────────
        if (action === "score") {
            try {
                if (!profile.kyc_selfie_url || !profile.kyc_document_url) {
                    throw new Error("Missing KYC images (selfie or document) for this user.");
                }

                if (!geminiApiKey) {
                    throw new Error("GEMINI_API_KEY is not configured on the server.");
                }

                // 1. Create S3 client directly (no internal function invocation)
                const s3Client = new S3Client({
                    region: awsRegion,
                    credentials: { accessKeyId: awsAccessKey, secretAccessKey: awsSecretKey },
                });

                const getS3SignedUrl = async (rawKey: string): Promise<string> => {
                    // Extract key from full S3 URL or use raw key
                    let key = rawKey;
                    if (rawKey.startsWith("http")) {
                        const url = new URL(rawKey);
                        key = decodeURIComponent(url.pathname.substring(1));
                    }
                    console.log("Generating S3 signed URL for key:", key);
                    const command = new GetObjectCommand({ Bucket: s3Bucket, Key: key });
                    return awsGetSignedUrl(s3Client, command, { expiresIn: 600 });
                };

                const [selfieUrl, docUrl] = await Promise.all([
                    getS3SignedUrl(profile.kyc_selfie_url),
                    getS3SignedUrl(profile.kyc_document_url),
                ]);

                console.log("Got signed URLs. Fetching image data...");

                // 2. Fetch images and convert to base64
                const fetchAsBase64 = async (url: string, label: string): Promise<{ base64: string; mimeType: string }> => {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Failed to fetch ${label} from S3: ${res.status} ${res.statusText}`);

                    const arrayBuffer = await res.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    let binaryString = "";
                    const chunkSize = 8192;
                    for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        const chunk = uint8Array.subarray(i, i + chunkSize);
                        binaryString += String.fromCharCode(...chunk);
                    }
                    const base64 = btoa(binaryString);
                    const mimeType = res.headers.get("content-type") || "image/jpeg";
                    return { base64, mimeType };
                };

                const [selfieData, docData] = await Promise.all([
                    fetchAsBase64(selfieUrl, "selfie"),
                    fetchAsBase64(docUrl, "document"),
                ]);

                console.log("Images fetched. Sending to Gemini Vision...");

                // 3. Prompt Gemini Vision
                const prompt = `You are a strict KYC and Fraud Analyst. A seller has applied for verification on an Indian marketplace.

You are provided TWO images:
Image 1 (first): The user's live selfie.
Image 2 (second): Their government-issued ID document.

User declared details:
- Full Name: ${profile.kyc_full_name}
- Document Type: ${profile.kyc_document_type}
- ID Number declared: ${profile.kyc_id_number}

Perform the following checks:
1. Face Match: Compare the face in Image 1 with the photo on the ID in Image 2. Give 0-100 percentage.
2. Document Authenticity: Does the ID look like a real physical document, or is it a screenshot/scan/digital copy?
3. ID Number Format: Does the format of "${profile.kyc_id_number}" match typical format for "${profile.kyc_document_type}"? (e.g. Aadhaar=12 digits, PAN=5 alpha-4 digit-1 alpha, Driving License=state+number). Just validate format, not exact data.
4. Name Match: Does the name visible on the ID document match "${profile.kyc_full_name}"?

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "face_match_percentage": <integer 0-100>,
  "document_authentic": <true|false>,
  "name_match": <true|false>,
  "id_format_valid": <true|false>,
  "confidence_score": <integer 0-100>,
  "reasoning": "<2-3 sentences summarizing your findings>",
  "recommendation": "<Approve|Reject|Review>"
}`;

                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: prompt },
                                    { inlineData: { mimeType: selfieData.mimeType, data: selfieData.base64 } },
                                    { inlineData: { mimeType: docData.mimeType, data: docData.base64 } },
                                ]
                            }],
                            generationConfig: {
                                temperature: 0.1,
                                maxOutputTokens: 2048,
                                // Disable thinking mode so JSON is returned directly without thought tokens eating budget
                                thinkingConfig: { thinkingBudget: 0 },
                            },
                        }),
                    }
                );

                if (!geminiResponse.ok) {
                    const errText = await geminiResponse.text();
                    console.error("Gemini API error:", errText);
                    throw new Error(`Gemini API call failed (${geminiResponse.status}): ${errText}`);
                }

                const geminiData = await geminiResponse.json();
                const parts = geminiData?.candidates?.[0]?.content?.parts || [];

                // Gemini 2.5-flash returns "thinking" tokens in early parts.
                // Find the part that actually contains our JSON (non-thought part with JSON object)
                let rawText = "";
                for (const part of parts) {
                    // Skip thought/reasoning parts
                    if (part.thought === true) continue;
                    const text = part.text || "";
                    // Pick this part if it looks like it contains JSON
                    if (text.includes("face_match_percentage") || text.includes("{")) {
                        rawText = text;
                        break;
                    }
                }
                // Fallback: concatenate all non-thought parts
                if (!rawText) {
                    rawText = parts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join(" ");
                }

                console.log("Gemini raw text:", rawText.substring(0, 500));

                let scoreData: Record<string, unknown> = {};
                try {
                    // Try to extract JSON object from anywhere in the response (handles leading/trailing text from Gemini)
                    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) throw new Error("No JSON object found in response");
                    scoreData = JSON.parse(jsonMatch[0]);
                } catch (_e) {
                    console.error("Failed to parse Gemini JSON:", rawText);
                    throw new Error(`Gemini returned non-JSON response: ${rawText.substring(0, 200)}`);
                }

                return new Response(
                    JSON.stringify({ success: true, ai_score: scoreData }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );

            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : JSON.stringify(error);
                console.error("Score action error:", msg);
                return new Response(
                    JSON.stringify({ error: "Failed to score KYC", details: msg }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
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

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : JSON.stringify(err);
        console.error("verify-seller top-level error:", msg);
        return new Response(JSON.stringify({ error: msg || "Internal server error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
