/**
 * Sanitizes and cleans PEM RSA Private Key format strings for Firebase Admin SDK initialization
 * and native Node.js crypto.
 */
export function cleanPrivateKey(key: string): string {
  if (!key) return "";
  let k = key.trim();

  // Strip wrapping outer quotes (single or double)
  while ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }

  // Replace literal backslash-n with real newlines and escaped quotes
  k = k.replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();

  // Look for standard PEM header and footer
  const headerMatch = k.match(/-----BEGIN [A-Z\s]+-----/);
  const footerMatch = k.match(/-----END [A-Z\s]+-----/);

  if (headerMatch && footerMatch) {
    const header = headerMatch[0];
    const footer = footerMatch[0];
    const bodyStart = k.indexOf(header) + header.length;
    const bodyEnd = k.indexOf(footer);
    const rawBody = k.substring(bodyStart, bodyEnd);

    // Keep only valid Base64 characters in body
    const cleanBody = rawBody.replace(/[^A-Za-z0-9+/=]/g, "");
    const chunkedBody = cleanBody.match(/.{1,64}/g)?.join("\n") || cleanBody;
    return `${header}\n${chunkedBody}\n${footer}`;
  }

  // If missing header/footer, assume raw base64 RSA private key string
  const cleanBody = k.replace(/[^A-Za-z0-9+/=]/g, "");
  const chunkedBody = cleanBody.match(/.{1,64}/g)?.join("\n") || cleanBody;
  return `-----BEGIN PRIVATE KEY-----\n${chunkedBody}\n-----END PRIVATE KEY-----`;
}
