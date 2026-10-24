const appPage = "__APP_HTML_JSON__";
const supabaseOrigin = "https://qedlkndcfzyqvintkvud.supabase.co";
const headers = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy": `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${supabaseOrigin}; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'`,
};
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/" || request.method !== "GET") {
      return new Response("Not found", { status: 404, headers });
    }
    return new Response(appPage, { status: 200, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  },
};
