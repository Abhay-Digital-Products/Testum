-- 1. Add planner_pdf_url to test_series table
ALTER TABLE public.test_series 
ADD COLUMN IF NOT EXISTS planner_pdf_url TEXT;

-- 2. Ensure storage bucket for planners exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('planners', 'planners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage policies for planners bucket
DROP POLICY IF EXISTS "Public can view planner pdfs" ON storage.objects;
CREATE POLICY "Public can view planner pdfs" ON storage.objects
  FOR SELECT USING (bucket_id = 'planners');

DROP POLICY IF EXISTS "Admin can upload planner pdfs" ON storage.objects;
CREATE POLICY "Admin can upload planner pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'planners' 
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::user_role)
      OR is_admin()
    )
  );

DROP POLICY IF EXISTS "Admin can update planner pdfs" ON storage.objects;
CREATE POLICY "Admin can update planner pdfs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'planners' 
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::user_role)
      OR is_admin()
    )
  );

DROP POLICY IF EXISTS "Admin can delete planner pdfs" ON storage.objects;
CREATE POLICY "Admin can delete planner pdfs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'planners' 
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::user_role)
      OR is_admin()
    )
  );
