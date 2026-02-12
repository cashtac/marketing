/* ═══════════════════════════════════════════════════════
 * Crypto Utilities for Cloudflare Workers
 * — JWT, hashing, token generation using Web Crypto API
 * ═══════════════════════════════════════════════════════ */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/* ── Generate cryptographically secure random token (256-bit) ── */
export function generateSecureToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── SHA-256 hash (for storing tokens server-side) ── */
export async function sha256(input) {
  const data = ENCODER.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Password hashing (PBKDF2 — Workers-compatible alternative to bcrypt) ── */
export async function hashPassword(password, salt) {
  if (!salt) {
    const saltBuf = new Uint8Array(16);
    crypto.getRandomValues(saltBuf);
    salt = Array.from(saltBuf).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const key = await crypto.subtle.importKey(
    'raw', ENCODER.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: ENCODER.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const hash = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt] = storedHash.split(':');
  const computed = await hashPassword(password, salt);
  return computed === storedHash;
}

/* ── JWT (using Web Crypto HMAC-SHA256) ── */
function base64url(input) {
  if (typeof input === 'string') {
    return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // ArrayBuffer
  const bytes = new Uint8Array(input);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

export async function signJWT(payload, secret, expiryMinutes = 15) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiryMinutes * 60,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(signingInput));
  return `${signingInput}.${base64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const key = await getHmacKey(secret);
    const signingInput = `${headerB64}.${payloadB64}`;
    const sig = base64urlDecode(sigB64);
    const valid = await crypto.subtle.verify('HMAC', key, sig, ENCODER.encode(signingInput));
    if (!valid) return null;
    const payload = JSON.parse(DECODER.decode(base64urlDecode(payloadB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ── TOTP (RFC 6238 — HMAC-based OTP) ── */
export function generateTOTPSecret() {
  const buf = new Uint8Array(20);
  crypto.getRandomValues(buf);
  return base32Encode(buf);
}

export async function verifyTOTP(secret, code, window = 1) {
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000);
  const step = 30;
  for (let i = -window; i <= window; i++) {
    const counter = Math.floor((now + i * step) / step);
    const expected = await generateHOTP(key, counter);
    if (expected === code) return true;
  }
  return false;
}

async function generateHOTP(key, counter) {
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setBigUint64(0, BigInt(counter));
  const hmacKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', hmacKey, counterBuf);
  const hash = new Uint8Array(sig);
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  return code.toString().padStart(6, '0');
}

/* Base32 encoding/decoding for TOTP secrets */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += BASE32_CHARS[parseInt(chunk, 2)];
  }
  return result;
}

function base32Decode(str) {
  let bits = '';
  for (const c of str.toUpperCase()) {
    const idx = BASE32_CHARS.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export function getTOTPUri(secret, email, issuer = 'CashTac Marketing') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
