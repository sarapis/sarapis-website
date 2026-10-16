// A VERBATIM copy of the verifying half of "Sign in with the CMS", from
// sarapis/collab-template worker/src/cms.js (v1.2.0): TICKET_KIND, MAX_TTL_S,
// b64urlToBytes, mac and verifyTicket, unchanged. collab-pass.int.spec.ts
// round-trips tickets minted by src/endpoints/collab-pass.ts through it, so a
// format change on this side goes red here. If the template changes its
// verifier, re-copy those lines.
export const TICKET_KIND = 'collab-identity';
// The CMS mints for two minutes; anything claiming longer is refused, so a
// misconfigured or compromised minter cannot issue a long-lived login.
export const MAX_TTL_S = 300;

const b64urlToBytes = (s) => {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function mac(secret, body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`v1.${body}`)));
}

// The claims, or null. Never throws: a verifier that can be made to throw is
// one whose caller might catch it and carry on.
export async function verifyTicket(token, secret, { host, state, now = Math.floor(Date.now() / 1000) } = {}) {
  try {
    if (!secret || typeof token !== 'string' || token.length > 2048) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1' || !parts[1] || !parts[2]) return null;
    const want = await mac(secret, parts[1]);
    const got = b64urlToBytes(parts[2]);
    if (got.length !== want.length) return null;
    let diff = 0;
    for (let i = 0; i < want.length; i++) diff |= want[i] ^ got[i];
    if (diff !== 0) return null;
    const c = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
    if (!c || typeof c !== 'object' || c.k !== TICKET_KIND) return null;
    if (typeof c.m !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(c.m)) return null;
    if (typeof c.e !== 'number' || c.e <= now || c.e > now + MAX_TTL_S) return null;
    if (typeof c.h !== 'string' || c.h.toLowerCase() !== String(host || '').toLowerCase()) return null;
    if (typeof c.s !== 'string' || !c.s || c.s !== state) return null;
    return { email: c.m.trim().toLowerCase(), expires: c.e, sig: parts[2] };
  } catch {
    return null;
  }
}
