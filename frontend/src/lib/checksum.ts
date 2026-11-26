/**
 * Utility functions for computing and verifying SHA-256 cryptographic checksums
 * of deliverable files and buffers in-browser using Web Crypto API.
 */

/**
 * Computes the lowercase hex-encoded SHA-256 hash of an ArrayBuffer.
 */
export async function calculateBufferChecksum(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes the lowercase hex-encoded SHA-256 hash of a File or Blob.
 */
export async function calculateFileChecksum(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return calculateBufferChecksum(arrayBuffer);
}

/**
 * Computes the lowercase hex-encoded SHA-256 hash of a string (UTF-8 encoded).
 */
export async function calculateStringChecksum(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return calculateBufferChecksum(data.buffer as ArrayBuffer);
}

/**
 * Compares a file's calculated SHA-256 checksum against an expected hash.
 * Case-insensitive comparison.
 */
export async function verifyFileChecksum(file: Blob, expectedHash: string): Promise<boolean> {
  if (!expectedHash || !expectedHash.trim()) {
    return false;
  }
  const calculated = await calculateFileChecksum(file);
  return calculated.toLowerCase() === expectedHash.trim().toLowerCase();
}

/**
 * Formats a SHA-256 hex string into a readable truncated representation.
 * Example: sha256: 3a7f...9b2c
 */
export function truncateHash(hash: string, leadChars = 4, trailChars = 4): string {
  if (!hash) return '';
  const clean = hash.replace(/^sha256:/i, '').trim();
  if (clean.length <= leadChars + trailChars) {
    return `sha256: ${clean}`;
  }
  return `sha256: ${clean.slice(0, leadChars)}...${clean.slice(-trailChars)}`;
}
