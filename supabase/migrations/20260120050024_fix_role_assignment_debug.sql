-- Fix role assignment in handle_new_user function
-- Add logging to help debug role assignment issues
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_role app_role;
  role_from_metadata text;
BEGIN
  -- Get the role from metadata
  role_from_metadata := NEW.raw_user_meta_data->>'role';
  
  -- Log what we received (this will appear in Supabase logs)
  RAISE LOG 'New user signup - ID: %, Email: %, Role from metadata: %', 
    NEW.id, NEW.email, role_from_metadata;
  
  -- Determine role from metadata, default to learner
  new_role := COALESCE(role_from_metadata::app_role, 'learner'::app_role);
  
  RAISE LOG 'Assigned role: %', new_role;
  
  -- Insert into profiles (without role column)
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, new_role);
  
  RAISE LOG 'Successfully created profile and role for user: %', NEW.id;
  
  RETURN NEW;
END;
$function$;
