-- profile fields
DO $$ BEGIN
  CREATE TYPE public.student_class AS ENUM ('11th','12th','dropper');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_class public.student_class;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile text;

-- plan codes
DO $$ BEGIN
  CREATE TYPE public.plan_code AS ENUM ('chapter','part','full','combo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code public.plan_code NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  price_inr numeric NOT NULL,
  duration_days integer NOT NULL DEFAULT 365,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans readable" ON public.plans;
CREATE POLICY "plans readable" ON public.plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin manages plans" ON public.plans;
CREATE POLICY "admin manages plans" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('created','paid','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code public.plan_code NOT NULL,
  amount_inr numeric NOT NULL,
  status public.order_status NOT NULL DEFAULT 'created',
  cf_order_id text,
  cf_payment_session_id text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_cf_order_id_idx ON public.orders(cf_order_id) WHERE cf_order_id IS NOT NULL;
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own orders" ON public.orders;
CREATE POLICY "users read own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "users insert own orders" ON public.orders;
CREATE POLICY "users insert own orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code public.plan_code NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_code)
);
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own entitlements" ON public.entitlements;
CREATE POLICY "users read own entitlements" ON public.entitlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin manages entitlements" ON public.entitlements;
CREATE POLICY "admin manages entitlements" ON public.entitlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- link series to a plan
ALTER TABLE public.test_series ADD COLUMN IF NOT EXISTS plan_code public.plan_code;
UPDATE public.test_series SET plan_code = kind::text::public.plan_code WHERE plan_code IS NULL;

CREATE OR REPLACE FUNCTION public.has_access(_user_id uuid, _plan public.plan_code)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = _user_id
      AND (e.plan_code = _plan OR e.plan_code = 'combo')
      AND (e.expires_at IS NULL OR e.expires_at > now())
  ) OR public.has_role(_user_id, 'admin');
$$;

CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER entitlements_updated_at BEFORE UPDATE ON public.entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plans (code, title, description, price_inr, sort_order) VALUES
  ('chapter','Chapter Wise Test Series','79 chapter-wise tests across Physics, Chemistry & Biology',99,1),
  ('part','Part Syllabus Test Series','Part syllabus tests to build exam stamina',99,2),
  ('full','Full Syllabus Test Series','Full syllabus NTA-pattern mock papers',99,3),
  ('combo','Combo Pack — Complete Access','Everything unlocked: chapter, part & full syllabus tests + AI analysis',149,4)
ON CONFLICT (code) DO NOTHING;

-- make signup trigger store class + mobile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, mobile, student_class)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'mobile',
    CASE WHEN NEW.raw_user_meta_data->>'student_class' IN ('11th','12th','dropper')
      THEN (NEW.raw_user_meta_data->>'student_class')::public.student_class ELSE NULL END
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();