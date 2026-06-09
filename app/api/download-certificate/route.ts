import { NextResponse } from 'next/server';
import { adminDb } from '@/src/lib/firebase-admin';
import { generateStorePDF } from '@/src/lib/pdfGenerator';

async function handleCertificateGeneration(code: string, ownerEmailInput?: string) {
  const cleanCode = code.trim().toUpperCase();

  // Query matching store
  const storesSnapshot = await adminDb
    .collection('stores')
    .where('trackingCode', '==', cleanCode)
    .get();

  if (storesSnapshot.empty) {
    throw new Error('Store asset registration record not found');
  }

  const store = storesSnapshot.docs[0] ? storesSnapshot.docs[0].data() : null;
  if (!store) {
    throw new Error('Store asset registration record not found');
  }

  // If email was provided, validate it
  if (ownerEmailInput) {
    const cleanEmail = ownerEmailInput.trim().toLowerCase();
    const recordEmail = (store.ownerEmail || '').trim().toLowerCase();
    if (recordEmail !== cleanEmail) {
      throw new Error('The provided email does not match the registered owner for this asset');
    }
  }

  const ownerName = store.ownerName || 'Valued Tenant';
  const storeName = store.storeName || 'Retail Space';
  const mallName = store.mallName || 'Broward Mall Complex';
  const purchaseDate = store.purchaseDate || store.createdAt || 'N/A';
  const expiryDate = store.expiryDate || 'N/A';

  // Generate the certificate PDF Buffer
  const pdfBuffer = await generateStorePDF({
    ownerName,
    storeName,
    trackingCode: cleanCode,
    mallName,
    purchaseDate,
    expiryDate,
  });

  return { pdfBuffer, cleanCode };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return new Response('Tracking code is required', { status: 400 });
    }

    const { pdfBuffer, cleanCode } = await handleCertificateGeneration(code);

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="Acquisition_Certificate_${cleanCode}.pdf"`);
    headers.set('Content-Length', pdfBuffer.length.toString());

    return new Response(pdfBuffer, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('API Download Certificate GET Error:', error);
    return new Response(error?.message || 'Server error generating PDF', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = body.trackingCode;
    const email = body.email || body.ownerEmail;

    if (!code || !email) {
      return NextResponse.json({ error: 'Tracking code and owner email are required' }, { status: 400 });
    }

    const { pdfBuffer, cleanCode } = await handleCertificateGeneration(code, email);

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="Acquisition_Certificate_${cleanCode}.pdf"`);
    headers.set('Content-Length', pdfBuffer.length.toString());

    return new Response(pdfBuffer, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('API Download Certificate POST Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error generating PDF' }, { status: 500 });
  }
}
