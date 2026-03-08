-- ============================================================
-- Shiprocket Delivery Integration
-- ============================================================

-- 1. Add per-seller pickup address fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pickup_name TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address JSONB,
  ADD COLUMN IF NOT EXISTS pickup_registered BOOLEAN NOT NULL DEFAULT false;

-- 2. Add delivery address + shipment status to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address JSONB,
  ADD COLUMN IF NOT EXISTS shipment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (shipment_status IN ('pending', 'shipped', 'delivered', 'failed'));

-- 3. Create shipments table
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shiprocket_order_id TEXT,
  shiprocket_shipment_id TEXT,
  awb_code TEXT,
  courier_name TEXT,
  courier_company_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by order
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);

-- 4. Enable RLS on shipments
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 5. RLS: buyers can view their own shipments (via order ownership)
DO $$ BEGIN
  CREATE POLICY "Buyers can view own shipments"
    ON public.shipments FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = shipments.order_id AND o.user_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 6. RLS: creators can view shipments for orders of their products
DO $$ BEGIN
  CREATE POLICY "Creators can view shipments for their products"
    ON public.shipments FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.products p ON p.id = o.product_id
        WHERE o.id = shipments.order_id AND p.creator_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 7. RLS: edge functions (service role) can insert/update shipments
DO $$ BEGIN
  CREATE POLICY "Service role can manage shipments"
    ON public.shipments FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 8. Trigger to auto-update updated_at on shipments
DO $$ BEGIN
  CREATE TRIGGER update_shipments_updated_at
    BEFORE UPDATE ON public.shipments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
