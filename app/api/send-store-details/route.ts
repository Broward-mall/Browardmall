import { NextResponse } from 'next/server';
import { adminDb } from '@/src/lib/firebase-admin';
import { generateStorePDF } from '@/src/lib/pdfGenerator';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const trackingCode = body.trackingCode;
    const ownerEmail = body.ownerEmail || body.email;

    if (!trackingCode || !ownerEmail) {
      return NextResponse.json({ error: 'Tracking code and owner email are required' }, { status: 400 });
    }

    const cleanCode = trackingCode.trim().toUpperCase();
    const cleanEmail = ownerEmail.trim().toLowerCase();

    // Query matching stores in admin db
    const storesSnapshot = await adminDb
      .collection('stores')
      .where('trackingCode', '==', cleanCode)
      .get();

    if (storesSnapshot.empty) {
      return NextResponse.json({ error: 'Store not found in records' }, { status: 404 });
    }

    // Get store doc
    const storeDoc = storesSnapshot.docs[0];
    const store = storeDoc.data();

    // Validate email
    const recordEmail = (store.ownerEmail || '').trim().toLowerCase();
    
    if (recordEmail !== cleanEmail) {
      return NextResponse.json({ 
        error: 'The provided email is not registered as the owner for this asset' 
      }, { status: 403 });
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
      expiryDate
    });

    const resendKey = process.env.RESEND_API_KEY || 're_fkNSZiP2_BWVqCpSqst3hJguqKx8QRcem';
    const resend = new Resend(resendKey);

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'acquisition@browardmall.site';

    const emailResponse = await resend.emails.send({
      from: `Broward Mall Registry <${fromEmail}>`,
      to: cleanEmail,
      subject: `Acquisition Certificate - ${storeName} (${cleanCode})`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0F172A; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; padding: 30px; border-radius: 16px; background-color: #FFFFFF;">
          <div style="border-bottom: 2px solid #2563EB; padding-bottom: 15px; margin-bottom: 20px;">
            <h1 style="color: #2563EB; font-size: 22px; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">Broward Mall Commercial Registry</h1>
          </div>
          <p style="font-size: 15px;">Dear <strong>${ownerName}</strong>,</p>
          <p style="font-size: 14px;">We are pleased to send you the certified documentation for your acquired commercial retail asset space.</p>
          <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #0F172A; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">Asset Highlights</h3>
            <p style="font-size: 13px; margin: 5px 0;"><strong>Store Space:</strong> ${storeName}</p>
            <p style="font-size: 13px; margin: 5px 0;"><strong>Tracking Code:</strong> <span style="font-family: monospace; font-weight: bold; color: #2563EB;">${cleanCode}</span></p>
            <p style="font-size: 13px; margin: 5px 0;"><strong>Location:</strong> ${store.floor || 'Ground Floor'}</p>
            <p style="font-size: 13px; margin: 5px 0;"><strong>Acquisition Date:</strong> ${purchaseDate}</p>
            <p style="font-size: 13px; margin: 5px 0;"><strong>Lease Expiration:</strong> ${expiryDate}</p>
          </div>
          <p style="font-size: 14px;">An official <strong>Certificate of Acquisition</strong> has been generated and is attached to this email as a PDF document for your company registers.</p>
          <p style="font-size: 14px; margin-top: 25px; border-top: 1px solid #E2E8F0; padding-top: 15px; color: #475569;">
            Sincerely,<br/>
            <strong>Leasing and Tenant Advisory Commission</strong><br/>
            Broward Mall Complex
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Acquisition_Certificate_${cleanCode}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Logging query record inside Firestore
    await adminDb.collection('emailRequests').add({
      trackingCode: cleanCode,
      ownerEmail: cleanEmail,
      requestDate: new Date().toISOString(),
      status: 'dispatched_successfully',
      resendId: emailResponse.data?.id || null
    });

    return NextResponse.json({ success: true, emailId: emailResponse.data?.id });
  } catch (error: any) {
    console.error('API Send Store Details Error:', error);
    return NextResponse.json({ error: error?.message || 'Server-side failure during dispatch' }, { status: 500 });
  }
}
