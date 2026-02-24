-- Add razorpay_order_id to payment_transfers
ALTER TABLE public.payment_transfers
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_transfers_razorpay_order_id
ON public.payment_transfers(razorpay_order_id);
