import { useS3Url } from "@/hooks/useS3Url";

interface S3MediaProps {
    src: string;
    alt?: string;
    className?: string;
    controls?: boolean;
    type?: 'image' | 'video' | 'auto';
}

export const S3Media = ({ src, alt, className, controls = true, type = 'auto' }: S3MediaProps) => {
    const { s3Url, loading } = useS3Url(src);

    if (loading) {
        return <div className={`${className} bg-muted animate-pulse rounded`} />;
    }

    const finalSrc = s3Url || src;
    const isVideo = type === 'video' || (type === 'auto' && (finalSrc.includes('.mp4') || finalSrc.includes('.webm')));

    if (isVideo) {
        return <video src={finalSrc} className={className} controls={controls} />;
    }

    return <img src={finalSrc} alt={alt} className={className} />;
};
