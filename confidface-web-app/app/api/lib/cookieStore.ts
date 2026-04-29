// Simple in-memory cookie store for D-ID session management
// Since D-ID uses HTTP-only cookies, we need to store and reuse them server-side

const cookieStore: Record<string, string> = {};

export function storeDIDCookies(setCookieHeaders: string | string[] | undefined): void {
  if (!setCookieHeaders) return;

  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  
  headers.forEach((cookie) => {
    // Parse cookie name and value
    const [nameValue] = cookie.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value) {
      cookieStore[name.trim()] = value.trim();
    }
  });

  console.log("D-ID cookies stored:", Object.keys(cookieStore));
}

export function getDIDCookieHeader(): string {
  const cookieString = Object.entries(cookieStore)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return cookieString;
}

export function clearDIDCookies(): void {
  Object.keys(cookieStore).forEach((key) => delete cookieStore[key]);
}
