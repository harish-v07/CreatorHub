import { supabase } from "@/integrations/supabase/client";

export interface S3UploadResult {
    url: string;
    key: string;
    bucket: string;
}

export const uploadToS3 = async (file: File, path: string): Promise<S3UploadResult> => {
    // 1. Get presigned URL from Edge Function
    const { data, error: functionError } = await supabase.functions.invoke('get-s3-upload-url', {
        body: {
            fileName: file.name,
            fileType: file.type,
            path: path,
        },
    });

    if (functionError) {
        throw new Error(`Failed to get upload URL: ${functionError.message}`);
    }

    const { signedUrl, key, bucket, region } = data;

    // 2. Upload file to S3
    const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
            'Content-Type': file.type,
        },
    });

    if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("S3 Upload Error Body:", errorText);
        throw new Error(`Failed to upload to S3: ${uploadResponse.statusText}. Details: ${errorText}`);
    }

    // 3. Construct the public URL
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
        url: publicUrl,
        key: key,
        bucket: bucket,
    };
};

export const getS3ViewUrl = async (key: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('get-s3-upload-url', {
        body: {
            action: 'view',
            key: key,
        },
    });

    if (error) {
        throw new Error(`Failed to get view URL: ${error.message}`);
    }

    return data.signedUrl;
};
