export function isBrowser() {
  return true;
}

export function randomUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
  return [hex.slice(0, 4), hex.slice(4, 6), hex.slice(6, 8), hex.slice(8, 10), hex.slice(10, 16)]
    .map((group) => group.join('')).join('-');
}

export function base64Encode(data) {
  if (typeof data === 'string') return globalThis.btoa(data);
  return globalThis.btoa(String.fromCharCode(...new Uint8Array(data)));
}

export function base64Decode(data) {
  return globalThis.atob(data);
}

export function isBase64Encoded(data) {
  try {
    return base64Encode(base64Decode(data)) === data;
  } catch (_) {
    return false;
  }
}

export function getBooleanEnvVar() {
  return false;
}

export function isEnterpriseModeEnabled() {
  return false;
}
