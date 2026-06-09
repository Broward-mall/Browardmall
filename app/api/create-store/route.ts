import { NextResponse } from 'next/server';
import { adminDb } from '@/src/lib/firebase-admin';
import { cookies } from 'next/headers';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return session && session.value === 'authenticated_broward_admin_2026';
}

export async function POST(req: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const { id, ...data } = payload;

    if (id) {
      // Update existing
      await adminDb.collection('stores').doc(id).set({
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return NextResponse.json({ success: true, id });
    } else {
      // Create new
      const docRef = adminDb.collection('stores').doc();
      const newId = docRef.id;
      await docRef.set({
        id: newId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true, id: newId });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Id is required' }, { status: 400 });
    }

    await adminDb.collection('stores').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
