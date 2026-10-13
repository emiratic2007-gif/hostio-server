// Where the Hostio server lives (Supabase Edge Function "hostio").
export const SERVER = "https://eauwnwvieyepzrbildqt.supabase.co/functions/v1/hostio";

// Forward a request to the server unchanged (same path, query, headers and body).
export async function forward(request, path) {
  const src = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const h of ["host", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor"]) headers.delete(h);
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const res = await fetch(SERVER + path + src.search, {
    method: request.method, headers, body: hasBody ? await request.arrayBuffer() : undefined, redirect: "manual",
  });
  const out = new Headers(res.headers);
  out.delete("content-encoding"); out.delete("content-length");
  return new Response(res.body, { status: res.status, headers: out });
}
