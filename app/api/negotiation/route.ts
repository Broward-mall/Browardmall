import { NextResponse } from 'next/server';
import { adminDb } from '@/src/lib/firebase-admin';
import { cookies } from 'next/headers';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return session && session.value === 'authenticated_broward_admin_2026';
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const isAdmin = await checkAdminAuth();

    if (payload.action === 'updateStatus') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { requestId, status, storeId } = payload;
      if (!requestId) {
        return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
      }

      await adminDb.collection('negotiationRequests').doc(requestId).update({ status });

      if (status === 'APPROVED' && storeId) {
        const negDoc = await adminDb.collection('negotiationRequests').doc(requestId).get();
        const negData = negDoc.data() || {};
        
        await adminDb.collection('stores').doc(storeId).set({
          status: 'Reserved',
          ownerName: negData.contactName || 'Valued Tenant',
          ownerEmail: negData.email || '',
          ownerPhone: negData.phone || '',
          purchaseDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ownershipType: 'Leased',
          ownershipStatus: 'Allocated'
        }, { merge: true });
      }

      return NextResponse.json({ success: true });
    }

    // Submit new negotiation request (make an offer)
    const { storeId, storeName, trackingCode, offerAmount, contactName, email, phone, message } = payload;
    if (!storeId || !trackingCode || !offerAmount || !contactName || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const docId = adminDb.collection('negotiationRequests').doc().id;
    await adminDb.collection('negotiationRequests').doc(docId).set({
      id: docId,
      storeId,
      storeName,
      trackingCode,
      offerAmount: Number(offerAmount),
      contactName,
      email,
      phone: phone || '',
      message: message || '',
      status: 'PENDING_ADMIN_APPROVAL',
      submittedAt: new Date().toISOString()
    });

    // transition store status
    await adminDb.collection('stores').doc(storeId).set({
      status: 'Under Negotiation'
    }, { merge: true });

    return NextResponse.json({ success: true, id: docId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshot = await adminDb.collection('negotiationRequests').orderBy('submittedAt', 'desc').get();
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
