-- 1. Create table for offer popups
CREATE TABLE IF NOT EXISTS public.offer_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Special Offer',
  image_url text NOT NULL,
  target_url text DEFAULT '/app/pricing',
  button_text text DEFAULT 'Claim Offer Now',
  coupon_code text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  display_frequency text NOT NULL DEFAULT 'once_per_session',
  target_audience text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grant permissions
GRANT SELECT ON public.offer_popups TO anon;
GRANT SELECT ON public.offer_popups TO authenticated;
GRANT ALL ON public.offer_popups TO service_role;
GRANT ALL ON public.offer_popups TO authenticated;

-- 3. Enable RLS
ALTER TABLE public.offer_popups ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
DROP POLICY IF EXISTS "offer_popups_select_all" ON public.offer_popups;
CREATE POLICY "offer_popups_select_all" ON public.offer_popups 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "offer_popups_admin_all" ON public.offer_popups;
CREATE POLICY "offer_popups_admin_all" ON public.offer_popups 
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND (user_roles.role = 'admin'::user_role)
    )
    OR is_admin()
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND (user_roles.role = 'admin'::user_role)
    )
    OR is_admin()
  );

-- 5. Trigger for updated_at
DROP TRIGGER IF EXISTS offer_popups_updated_at ON public.offer_popups;
CREATE TRIGGER offer_popups_updated_at BEFORE UPDATE ON public.offer_popups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Ensure storage bucket for promotions exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
DROP POLICY IF EXISTS "Public can view promotion images" ON storage.objects;
CREATE POLICY "Public can view promotion images" ON storage.objects
  FOR SELECT USING (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Admin can upload promotion images" ON storage.objects;
CREATE POLICY "Admin can upload promotion images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'promotions' 
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::user_role)
      OR is_admin()
    )
  );

DROP POLICY IF EXISTS "Admin can update promotion images" ON storage.objects;
CREATE POLICY "Admin can update promotion images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'promotions' 
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::user_role)
      OR is_admin()
    )
  );

DROP POLICY IF EXISTS "Admin can delete promotion images" ON storage.objects;
CREATE POLICY "Admin can delete promotion images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'promotions' 
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::user_role)
      OR is_admin()
    )
  );
