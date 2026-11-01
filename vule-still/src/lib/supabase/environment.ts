export function getSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key are not configured.");
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Use a Supabase publishable key for the application client.");
  }

  return { url, publishableKey };
}
