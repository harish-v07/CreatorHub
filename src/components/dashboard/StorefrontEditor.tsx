import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { profileSchema } from "@/lib/validation";
import { uploadToS3 } from "@/lib/s3-upload";
import { Upload, X } from "lucide-react";
import { useS3Url } from "@/hooks/useS3Url";

export default function StorefrontEditor() {
  const [loading, setLoading] = useState(false);

  // File states for direct uploads
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    bio: "",
    banner_url: "",
    avatar_url: "",
    social_links: {
      instagram: "",
      twitter: "",
      website: "",
    },
  });

  const { s3Url: signedBannerUrl } = useS3Url(formData?.banner_url || undefined);
  const { s3Url: signedAvatarUrl } = useS3Url(formData?.avatar_url || undefined);

  // Use the local file preview if available, otherwise fallback to the signed S3 url, otherwise null
  const currentBannerPreview = bannerPreview || signedBannerUrl;
  const currentAvatarPreview = avatarPreview || signedAvatarUrl;

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
    } else if (data) {
      const socialLinks = typeof data.social_links === 'object' && data.social_links !== null
        ? data.social_links as { instagram?: string; twitter?: string; website?: string }
        : { instagram: "", twitter: "", website: "" };

      setFormData({
        bio: data.bio || "",
        banner_url: data.banner_url || "",
        avatar_url: data.avatar_url || "",
        social_links: {
          instagram: socialLinks.instagram || "",
          twitter: socialLinks.twitter || "",
          website: socialLinks.website || "",
        },
      });
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "banner" | "avatar"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error("Image must be less than 5MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    if (type === "banner") {
      setBannerFile(file);
      setBannerPreview(previewUrl);
    } else {
      setAvatarFile(file);
      setAvatarPreview(previewUrl);
    }
  };

  const removeImage = (type: "banner" | "avatar") => {
    if (type === "banner") {
      setBannerFile(null);
      setBannerPreview(null);
      setFormData(prev => ({ ...prev, banner_url: "" }));
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    } else {
      setAvatarFile(null);
      setAvatarPreview(null);
      setFormData(prev => ({ ...prev, avatar_url: "" }));
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalBannerUrl = formData.banner_url;
      let finalAvatarUrl = formData.avatar_url;

      // Helper to sanitize filename to prevent S3 URL encoding issues (404s)
      const sanitizeFile = (file: File) => {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/-+/g, '-');
        return new File([file], cleanName, { type: file.type });
      };

      // Upload banner if new file selected
      if (bannerFile) {
        const safeBannerFile = sanitizeFile(bannerFile);
        const result = await uploadToS3(safeBannerFile, "profiles");
        finalBannerUrl = result.url;
      }

      // Upload avatar if new file selected
      if (avatarFile) {
        const safeAvatarFile = sanitizeFile(avatarFile);
        const result = await uploadToS3(safeAvatarFile, "profiles");
        finalAvatarUrl = result.url;
      }

      const updatedFormData = {
        ...formData,
        banner_url: finalBannerUrl,
        avatar_url: finalAvatarUrl
      };

      // Validate input
      const validation = profileSchema.safeParse(updatedFormData);
      if (!validation.success) {
        toast.error(validation.error.issues[0].message);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase
        .from("profiles")
        .update({
          bio: validation.data.bio,
          banner_url: validation.data.banner_url,
          avatar_url: validation.data.avatar_url,
          social_links: validation.data.social_links,
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      toast.success("Storefront updated successfully!");

      // Update local state with saved URLs
      setFormData(updatedFormData);
      setBannerFile(null);
      setAvatarFile(null);

    } catch (error: any) {
      toast.error(error.message || "Error updating storefront");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Edit Your Storefront</CardTitle>
          <CardDescription>Customize how your creator page appears to visitors</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Banner Upload Section */}
            <div className="space-y-2 relative">
              <Label htmlFor="banner_url">Storefront Banner</Label>
              <div className="border-2 border-dashed rounded-lg p-1 overflow-hidden h-40 relative group bg-muted/30">
                {currentBannerPreview ? (
                  <>
                    <img src={currentBannerPreview} alt="Banner Preview" className="w-full h-full object-cover rounded-md" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => bannerInputRef.current?.click()}
                        className="mr-2"
                      >
                        Change
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeImage('banner')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted/50 rounded-md transition-colors"
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-sm font-medium">Click to upload banner</span>
                    <span className="text-xs opacity-70 mt-1">1200 x 400px recommended (Max 5MB)</span>
                  </div>
                )}
                <input
                  ref={bannerInputRef}
                  id="banner-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'banner')}
                />
              </div>
            </div>

            {/* Profile Picture and Bio Section */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="space-y-2">
                <Label>Profile Picture</Label>
                <div className="relative group w-32 h-32 mx-auto md:mx-0">
                  {currentAvatarPreview ? (
                    <div className="w-full h-full rounded-full overflow-hidden border-4 border-background shadow-md relative">
                      <img src={currentAvatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => removeImage('avatar')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-full h-full rounded-full border-2 border-dashed flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted/50 transition-colors"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Upload className="h-6 w-6 mb-1 opacity-50" />
                      <span className="text-xs text-center px-2">Upload Photo</span>
                    </div>
                  )}

                  {currentAvatarPreview && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs rounded-full shadow-sm"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      Change
                    </Button>
                  )}
                  <input
                    ref={avatarInputRef}
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, 'avatar')}
                  />
                </div>
              </div>

              <div className="space-y-2 flex-1">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell learners about yourself and your creative work..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={5}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label>Social Media Links</Label>
              <div className="grid gap-3">
                <Input
                  placeholder="Instagram Profile URL (e.g., https://instagram.com/username)"
                  value={formData.social_links.instagram}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      social_links: { ...formData.social_links, instagram: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder="Twitter Profile URL (e.g., https://twitter.com/username)"
                  value={formData.social_links.twitter}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      social_links: { ...formData.social_links, twitter: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder="Personal Website or Portfolio URL"
                  value={formData.social_links.website}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      social_links: { ...formData.social_links, website: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full text-lg py-6 mt-4">
              {loading ? "Saving Changes..." : "Save Storefront Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}