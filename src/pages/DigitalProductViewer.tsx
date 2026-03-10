import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Download, Package, Lock, FileArchive, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { S3Media } from "@/components/S3Media";
import { getS3ViewUrl } from "@/lib/s3-upload";

export default function DigitalProductViewer() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    checkAccessAndFetchProduct();
  }, [productId]);

  const checkAccessAndFetchProduct = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch Product Details
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(`
          *,
          public_profiles:creator_id (name)
        `)
        .eq("id", productId)
        .single();

      if (productError || !productData) {
        toast.error("Digital product not found");
        navigate("/dashboard");
        return;
      }
      
      console.log("FETCHED DIGITAL PRODUCT DATA:", productData);
      setProduct(productData);

      // Verify Access (Is Creator OR Has valid Paid Order)
      const isCreator = productData.creator_id === user.id;
      
      let userHasPurchased = false;
      if (!isCreator) {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, status")
          .eq("product_id", productId)
          .eq("user_id", user.id)
          .eq("status", "completed")
          .limit(1);

        userHasPurchased = !!ordersData && ordersData.length > 0;
      }

      setHasAccess(isCreator || userHasPurchased);

    } catch (err: any) {
      console.error("Error fetching digital product:", err);
      toast.error("Failed to load digital product details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!product?.file_url) {
        toast.error("Download link is missing for this product.");
        return;
    }
    
    try {
        setDownloading(true);
        // The bucket is private, so we need to generate a temporary pre-signed URL for the buyer
        const signedUrl = await getS3ViewUrl(product.file_url);
        window.open(signedUrl, "_blank");
    } catch (err) {
        console.error("Failed to generate download url:", err);
        toast.error("Failed to generate a secure download link. Please try again later.");
    } finally {
        setDownloading(false);
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-gradient-hero">
            <Navbar />
            <div className="pt-32 text-center text-muted-foreground">Verifying access...</div>
        </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar />
        <div className="container mx-auto pt-32 px-4 max-w-2xl text-center">
          <Card className="shadow-soft p-12">
            <Lock className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-3xl font-bold mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              You haven't purchased this digital product yet, or your payment is still processing.
            </p>
            <Button size="lg" onClick={() => navigate(`/product/${productId}`)}>
              View Product Page
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const mediaUrls = product?.media_urls || [];
  const primaryMedia = mediaUrls.length > 0 ? mediaUrls[0] : null;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto pt-32 pb-20 px-4 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/my-orders")} className="mb-6 hover:bg-white/10">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Orders
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column: Product Info & Image */}
            <div className="md:col-span-1 space-y-6">
                <Card className="shadow-soft overflow-hidden border-none bg-card/50 backdrop-blur-sm">
                    {primaryMedia ? (
                        <div className="aspect-square relative w-full">
                            <S3Media src={primaryMedia} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="aspect-square bg-muted flex flex-col items-center justify-center text-muted-foreground border-b border-white/5">
                            <Package className="h-16 w-16 mb-4 opacity-50" />
                            <span className="text-sm font-medium">Digital Product</span>
                        </div>
                    )}
                    <CardHeader className="p-6">
                        <div className="text-sm font-medium text-emerald-500 mb-2 flex items-center gap-2">
                            <FileArchive className="h-4 w-4" />
                            Digital Download
                        </div>
                        <CardTitle className="text-2xl leading-tight">{product?.name}</CardTitle>
                        <CardDescription className="text-sm mt-3 flex items-center gap-2">
                            <span>By {product?.public_profiles?.name || "Creator"}</span>
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            {/* Right Column: Download & Instructions */}
            <div className="md:col-span-2 space-y-6">
                <Card className="shadow-soft border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5 text-primary" />
                            Secure Download
                        </CardTitle>
                        <CardDescription>
                            You have unlimited access to download this file.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {product?.file_url ? (
                            <Button 
                                size="lg" 
                                className="w-full sm:w-auto gap-2 group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5" 
                                onClick={handleDownload}
                                disabled={downloading}
                            >
                                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 -translate-x-full group-hover:animate-shimmer" />
                                {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                                {downloading ? "Generating Secure Link..." : "Download Zip File"}
                            </Button>
                        ) : (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 dark:text-yellow-400 text-sm">
                                The creator hasn't attached a valid zip file yet. Please contact the creator.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {product?.usage_instructions && (
                    <Card className="shadow-soft bg-card/60 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Usage Setup & Instructions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {product.usage_instructions}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="shadow-soft bg-card/60 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Product Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                            {product?.description || "No description provided."}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </div>
  );
}
