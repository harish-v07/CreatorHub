import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, PutObjectCommand, GetObjectCommand } from "npm:@aws-sdk/client-s3"
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        const { fileName, fileType, path, action = 'upload', key: existingKey } = await req.json()

        if (action === 'upload' && (!fileName || !fileType)) {
            return new Response(JSON.stringify({ error: 'Missing fileName or fileType for upload' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        const region = Deno.env.get('AWS_REGION') || 'us-east-1'
        const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID') || ''
        const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') || ''
        const bucketName = Deno.env.get('AWS_S3_BUCKET_NAME') || ''

        // Debug: log which secrets are available (never log actual secret values)
        console.log('AWS Config:', {
            region,
            hasAccessKey: !!accessKeyId,
            hasSecretKey: !!secretAccessKey,
            bucket: bucketName,
            action,
        })

        if (!accessKeyId || !secretAccessKey || !bucketName) {
            return new Response(JSON.stringify({ error: 'Missing AWS configuration secrets' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            })
        }

        const s3Client = new S3Client({
            region,
            credentials: { accessKeyId, secretAccessKey },
        })

        let key = existingKey
        let command

        if (action === 'upload') {
            key = `${path}/${Date.now()}-${fileName}`
            command = new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                ContentType: fileType,
            })
        } else if (action === 'view') {
            if (!existingKey) {
                return new Response(JSON.stringify({ error: 'Missing key for view action' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                })
            }
            // If it's a full URL, extract the key
            if (existingKey.startsWith('http')) {
                const url = new URL(existingKey)
                // decodeURIComponent is critical: pathname has %20 for spaces,
                // but S3 GetObject needs the raw unencoded key
                key = decodeURIComponent(url.pathname.substring(1))
            }

            console.log('Generating signed URL for key:', key, 'bucket:', bucketName)

            command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            })
        } else {
            return new Response(JSON.stringify({ error: 'Invalid action' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

        return new Response(
            JSON.stringify({ signedUrl, key, bucket: bucketName, region }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
