import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { profileSchema } from "@/lib/validation";

export default function StorefrontEditor() {
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate input
    const validation = profileSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
      toast.error("Error updating storefront");
      console.error(error);
    } else {
      toast.success("Storefront updated successfully!");
    }

    setLoading(false);
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
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell learners about yourself and your creative work..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner_url">Banner Image URL</Label>
              <Input
                id="banner_url"
                type="url"
                placeholder="https://example.com/banner.jpg"
                value={formData.banner_url}
                onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar_url">Profile Picture URL</Label>
              <Input
                id="avatar_url"
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={formData.avatar_url}
                onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              <Label>Social Media Links</Label>
              <div className="space-y-3">
                <Input
                  placeholder="Instagram URL"
                  value={formData.social_links.instagram}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      social_links: { ...formData.social_links, instagram: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder="Twitter URL"
                  value={formData.social_links.twitter}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      social_links: { ...formData.social_links, twitter: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder="Website URL"
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

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}