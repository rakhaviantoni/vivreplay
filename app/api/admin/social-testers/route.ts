import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/server/admin-auth';
import {
  listAdminSocialTesterRequests,
  updateSocialTesterRequestStatus,
  type SocialTesterRequestStatus,
} from '@/lib/server/postforme';

const ALLOWED_STATUSES: SocialTesterRequestStatus[] = [
  'PENDING',
  'INVITED',
  'APPROVED',
  'DECLINED',
];

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const requests = await listAdminSocialTesterRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load requests' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: SocialTesterRequestStatus;
  } | null;

  if (!body?.id || !body?.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid request id or status' }, { status: 400 });
  }

  try {
    const updated = await updateSocialTesterRequestStatus(body.id, body.status);
    if (!updated) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update status' },
      { status: 500 }
    );
  }
}
