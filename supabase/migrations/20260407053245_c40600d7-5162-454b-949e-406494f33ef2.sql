
-- Fix: Allow users to insert their own role (for setup wizard first-user flow)
-- The current policy only allows admins. We need to allow self-insert for first user.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Allow admins to manage all roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow users to insert their own role when they have no company (first-time setup)
CREATE POLICY "Users can self-assign role during setup" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- Add contact_person column to buyers
ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS contact_person text;

-- Recreate handle_new_user to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'pending'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to ensure it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
