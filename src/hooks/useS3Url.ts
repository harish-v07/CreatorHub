import { useState, useEffect } from 'react';
import { getS3ViewUrl } from '@/lib/s3-upload';

export const useS3Url = (url: string | undefined) => {
    const [s3Url, setS3Url] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        if (!url) {
            setS3Url(undefined);
            return;
        }

        if (url.startsWith('http') && (url.includes('amazonaws.com') || url.includes('.s3.'))) {
            setLoading(true);
            getS3ViewUrl(url)
                .then(signedUrl => {
                    setS3Url(signedUrl);
                    setError(null);
                })
                .catch(err => {
                    console.error("Error fetching S3 signed URL:", err);
                    setError(err);
                    // Fallback to original URL
                    setS3Url(url);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setS3Url(url);
            setLoading(false);
        }
    }, [url]);

    return { s3Url, loading, error };
};
