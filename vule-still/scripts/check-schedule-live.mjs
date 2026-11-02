// Read-only test-project probe; never prepares or publishes a week.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || new URL(url).hostname !== "xfbjgxtgvlyndonhlupm.supabase.co" || !key)
  throw new Error("This check is restricted to Vule-still-test with a publishable key.");
const response = await fetch(`${url}/rest/v1/rpc/published_schedule`,{
  method:"POST", headers:{apikey:key,authorization:`Bearer ${key}`,"content-type":"application/json"},
  body:JSON.stringify({p_week:"2026-11-02"}),
});
console.log(JSON.stringify({project:new URL(url).hostname,status:response.status,
  result:response.ok?"published schedule RPC available":"published schedule RPC unavailable",
  writesPerformed:0}));
if (!response.ok) process.exitCode=1;
