/**
 * Cloudflare Access identity verification.
 *
 * Access sits in front of the whole site. When a request reaches these
 * functions it carries a `Cf-Access-Jwt-Assertion` header holding a JWT that
 * Access signed after authenticating the user. Verifying that JWT is the entire
 * authentication step — there are no passwords in this application.
 *
 * The header alone is NOT trustworthy: anyone can set a header. What makes it
 * trustworthy is checking the RS256 signature against the team's published
 * public keys, plus the audience, issuer and expiry. All four are checked here.
 */

export interface AccessIdentity {
  email: string;
  /** Access's stable per-user id (the JWT `sub`). */
  subject: string;
}

export interface AccessEnv {
  /** e.g. "yourteam" for https://yourteam.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Application Audience (AUD) tag from the Access application. */
  ACCESS_AUD?: string;
  /**
   * Local development only. `wrangler pages dev` has no Access in front of it,
   * so without this every request would be unauthenticated and the app would be
   * untestable. Setting it in a deployed environment would disable authentication
   * entirely, which is why it is refused whenever a team domain is configured.
   */
  DEV_ACCESS_EMAIL?: string;
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

/** Cached across requests within an isolate; Access rotates keys infrequently. */
let jwksCache: { teamDomain: string; keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

const b64urlToBytes = (input: string): Uint8Array => {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

const b64urlToString = (input: string): string =>
  new TextDecoder().decode(b64urlToBytes(input));

async function fetchJwks(teamDomain: string): Promise<Jwk[]> {
  const fresh = jwksCache
    && jwksCache.teamDomain === teamDomain
    && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh) return jwksCache!.keys;

  const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch Access public keys (${res.status})`);

  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys || [];
  if (keys.length === 0) throw new Error('Access returned no public keys');

  jwksCache = { teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

/**
 * Returns the verified identity, or null when the token is absent or invalid.
 * Never returns an identity derived from unverified input.
 */
export async function verifyAccessJwt(
  request: Request,
  env: AccessEnv
): Promise<AccessIdentity | null> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.ACCESS_AUD?.trim();

  // Local development escape hatch, deliberately impossible to leave on by
  // accident: the moment a team domain exists, real verification is required.
  if (!teamDomain && env.DEV_ACCESS_EMAIL) {
    return { email: env.DEV_ACCESS_EMAIL.toLowerCase(), subject: `dev-${env.DEV_ACCESS_EMAIL}` };
  }

  if (!teamDomain || !aud) return null;

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string; sub?: string };
  try {
    header = JSON.parse(b64urlToString(headerB64));
    payload = JSON.parse(b64urlToString(payloadB64));
  } catch {
    return null;
  }

  // Pin the algorithm. Accepting whatever the token names would allow an
  // attacker to downgrade to "none" or to a symmetric algorithm.
  if (header.alg !== 'RS256' || !header.kid) return null;

  const keys = await fetchJwks(teamDomain);
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(signatureB64),
    signed
  );
  if (!valid) return null;

  // A valid signature only proves Access issued the token. These checks prove it
  // was issued for *this* application and is still current.
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) return null;

  if (payload.iss !== `https://${teamDomain}.cloudflareaccess.com`) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > nowSeconds) return null;

  if (!payload.email || !payload.sub) return null;

  return { email: payload.email.toLowerCase(), subject: payload.sub };
}
