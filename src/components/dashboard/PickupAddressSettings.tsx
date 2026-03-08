import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, MapPin, AlertTriangle, Truck } from "lucide-react";

export default function PickupAddressSettings() {
    const [loading, setLoading] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [form, setForm] = useState({
        contactName: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
    });

    useEffect(() => {
        loadPickupAddress();
    }, []);

    const loadPickupAddress = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("profiles")
            .select("pickup_address, pickup_registered")
            .eq("id", user.id)
            .single();

        if (profile?.pickup_address) {
            const addr = profile.pickup_address as any;
            setForm({
                contactName: addr.contactName || "",
                phone: addr.phone || "",
                address: addr.address || "",
                city: addr.city || "",
                state: addr.state || "",
                pincode: addr.pincode || "",
            });
        }
        setRegistered(!!profile?.pickup_registered);
    };

    const handleSave = async () => {
        if (!form.contactName || !form.phone || !form.address || !form.city || !form.state || !form.pincode) {
            toast.error("Please fill in all fields");
            return;
        }
        if (form.phone.length !== 10) {
            toast.error("Phone number must be 10 digits");
            return;
        }
        if (form.pincode.length !== 6) {
            toast.error("Pincode must be 6 digits");
            return;
        }

        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const res = await fetch(`${supabaseUrl}/functions/v1/register-pickup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                },
                body: JSON.stringify(form),
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || "Failed to register pickup address");
            }

            setRegistered(true);
            toast.success("Pickup address registered successfully! You can now ship physical products.");
        } catch (err: any) {
            console.error("Pickup registration error:", err);
            toast.error(err.message || "Failed to register pickup address");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Shipping Pickup Address
                </CardTitle>
                <CardDescription>
                    Your address from where Shiprocket will pick up physical product orders.
                    {registered && (
                        <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4" /> Registered
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!registered && (
                    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800 dark:text-amber-300">
                            <p className="font-medium">Pickup address not registered</p>
                            <p className="mt-1">You need to register a pickup address to enable shipping for your physical products.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="pickup-contact-name">Contact Name *</Label>
                        <Input
                            id="pickup-contact-name"
                            placeholder="Full name for pickup contact"
                            value={form.contactName}
                            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                        />
                    </div>

                    <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="pickup-phone">Phone Number *</Label>
                        <Input
                            id="pickup-phone"
                            placeholder="10-digit mobile number"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                            maxLength={10}
                        />
                    </div>

                    <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="pickup-address">Pickup Address *</Label>
                        <Textarea
                            id="pickup-address"
                            placeholder="e.g. Flat 4, Green Apartments, MG Road"
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                            ⚠️ Must start with House No. / Flat No. / Road No. (e.g. "Flat 4, Building Name, Street")
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pickup-city">City *</Label>
                        <Input
                            id="pickup-city"
                            placeholder="City"
                            value={form.city}
                            onChange={(e) => setForm({ ...form, city: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pickup-state">State *</Label>
                        <Input
                            id="pickup-state"
                            placeholder="State"
                            value={form.state}
                            onChange={(e) => setForm({ ...form, state: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pickup-pincode">Pincode *</Label>
                        <Input
                            id="pickup-pincode"
                            placeholder="6-digit pincode"
                            value={form.pincode}
                            onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                            maxLength={6}
                        />
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full gap-2"
                >
                    <MapPin className="h-4 w-4" />
                    {loading ? "Registering..." : registered ? "Update Pickup Address" : "Register Pickup Address"}
                </Button>

                {registered && (
                    <p className="text-xs text-muted-foreground text-center">
                        ✅ Shiprocket will use this address to pick up your physical product orders.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
