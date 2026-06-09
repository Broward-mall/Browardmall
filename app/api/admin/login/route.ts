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
    const { email, password } = payload;

    if (email === 'admin@browardmall.com' && password === 'BrowardAdmin2026!') {
      const response = NextResponse.json({ success: true });
      response.cookies.set('admin_session', 'authenticated_broward_admin_2026', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
      });
      return response;
    }

    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
