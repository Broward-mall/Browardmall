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

      // Update allocation request
      await adminDb.collection('allocationRequests').doc(requestId).update({ status });

      // If approved, update the store's ownership and status to Leased/Reserved!
      if (status === 'APPROVED' && storeId) {
        const allocDoc = await adminDb.collection('allocationRequests').doc(requestId).get();
        const allocData = allocDoc.data() || {};
        
        await adminDb.collection('stores').doc(storeId).set({
          status: 'Reserved',
          ownerName: allocData.fullName || 'Valued Tenant',
          ownerEmail: allocData.email || '',
          ownerPhone: allocData.phone || '',
          purchaseDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year lease
          ownershipType: 'Leased',
          ownershipStatus: 'Allocated'
        }, { merge: true });
      }

      return NextResponse.json({ success: true });
    }

    // New allocation request submit
    const { fullName, email, phone, offerAmount, notes, storeId, storeName, trackingCode } = payload;
    if (!fullName || !email || !storeId || !trackingCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const docId = adminDb.collection('allocationRequests').doc().id;
    await adminDb.collection('allocationRequests').doc(docId).set({
      id: docId,
      fullName,
      email,
      phone: phone || '',
      offerAmount: Number(offerAmount) || 0,
      notes: notes || '',
      storeId,
      storeName,
      trackingCode,
      status: 'PENDING_ADMIN_APPROVAL',
      createdAt: new Date().toISOString()
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
    const snapshot = await adminDb.collection('allocationRequests').orderBy('createdAt', 'desc').get();
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
