/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Native Web Crypto SHA-1 for secure parameter signing
async function sha1(string: string): Promise<string> {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-1', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Uploads a file to Cloudinary using signed upload parameters
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME || "dslmifwmq";
  const apiKey = (import.meta as any).env.VITE_CLOUDINARY_API_KEY || "628365726991323";
  const apiSecret = (import.meta as any).env.VITE_CLOUDINARY_API_SECRET || "hiHxUnwiBtxeTZlk7a2MrUDS_UU";

  const timestamp = Math.round(new Date().getTime() / 1000).toString();
  
  // Sorted alphabetically, joined, and ended with API Secret
  const stringToSign = `timestamp=${timestamp}${apiSecret}`;
  const signature = await sha1(stringToSign);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(errorData.error?.message || `Cloudinary status ${response.status}`);
  }

  const data = await response.json();
  return data.secure_url;
}
