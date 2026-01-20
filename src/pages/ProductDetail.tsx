import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ProductDetail() {
    const { productId } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

    useEffect(() => {
        fetchProduct();
    }, [productId]);

    const fetchProduct = async () => {
        const { data, error } = await supabase
            .from("products")
            .select("*, profiles(name, avatar_url)")
            .eq("id", productId)
            .single();

        if (error) {
            toast.error("Product not found");
            navigate("/explore");
        } else {
            setProduct(data);
        }
        setLoading(false);
    };

    const nextMedia = () => {
        if (product?.media_urls && currentMediaIndex < product.media_urls.length - 1) {
            setCurrentMediaIndex(currentMediaIndex + 1);
        }
    };

    const prevMedia = () => {
        if (currentMediaIndex > 0) {
            setCurrentMediaIndex(currentMediaIndex - 1);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-hero">
                <Navbar />
                <div className="container mx-auto px-4 pt-32">
                    <div className="text-center">Loading...</div>
                </div>
            </div>
        );
    }

    if (!product) {
        return null;
    }

    const currentMedia = product.media_urls?.[currentMediaIndex];
    const isVideo = currentMedia?.includes('.mp4') || currentMedia?.includes('.webm');

    return (
        <div className="min-h-screen bg-gradient-hero">
            <Navbar />
            <div className="container mx-auto px-4 pt-32 pb-20">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-6"
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Media Gallery */}
                    <div className="space-y-4">
                        <Card className="shadow-hover overflow-hidden">
                            <CardContent className="p-0">
                                <div className="relative aspect-square bg-muted">
                                    {currentMedia ? (
                                        <>
                                            {isVideo ? (
                                                <video
                                                    src={currentMedia}
                                                    className="w-full h-full object-contain"
                                                    controls
                                                />
                                            ) : (
                                                <img
                                                    src={currentMedia}
                                                    alt={product.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            )}

                                            {product.media_urls.length > 1 && (
                                                <>
                                                    <Button
                                                        variant="secondary"
                                                        size="icon"
                                                        className="absolute left-2 top-1/2 -translate-y-1/2"
                                                        onClick={prevMedia}
                                                        disabled={currentMediaIndex === 0}
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="icon"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2"
                                                        onClick={nextMedia}
                                                        disabled={currentMediaIndex === product.media_urls.length - 1}
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
                                                        {currentMediaIndex + 1} / {product.media_urls.length}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            No media available
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Thumbnails */}
                        {product.media_urls && product.media_urls.length > 1 && (
                            <div className="grid grid-cols-4 gap-2">
                                {product.media_urls.map((url: string, index: number) => {
                                    const isThumbVideo = url.includes('.mp4') || url.includes('.webm');
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => setCurrentMediaIndex(index)}
                                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${currentMediaIndex === index
                                                    ? 'border-primary shadow-md'
                                                    : 'border-transparent hover:border-primary/50'
                                                }`}
                                        >
                                            {isThumbVideo ? (
                                                <video src={url} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={url} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
                            <p className="text-3xl font-bold text-primary">₹{product.price}</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="px-4 py-2 rounded-full text-sm bg-secondary text-secondary-foreground">
                                {product.type}
                            </span>
                        </div>

                        <div className="prose prose-sm max-w-none">
                            <h3 className="text-lg font-semibold mb-2">Description</h3>
                            <p className="text-muted-foreground whitespace-pre-wrap">
                                {product.description || "No description available"}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button className="w-full" size="lg">
                                Add to Cart
                            </Button>
                            <Button variant="outline" className="w-full" size="lg">
                                Buy Now
                            </Button>
                        </div>

                        {product.profiles && (
                            <Card className="shadow-soft">
                                <CardContent className="p-4">
                                    <p className="text-sm text-muted-foreground mb-2">Sold by</p>
                                    <div className="flex items-center gap-3">
                                        {product.profiles.avatar_url && (
                                            <img
                                                src={product.profiles.avatar_url}
                                                alt={product.profiles.name}
                                                className="w-10 h-10 rounded-full"
                                            />
                                        )}
                                        <p className="font-semibold">{product.profiles.name}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
