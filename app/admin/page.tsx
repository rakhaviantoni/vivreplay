import {AdminDashboard} from '@/components/admin/admin-dashboard';
import {AdminAccess} from '@/components/admin/admin-access';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

export const dynamic='force-dynamic';

export default async function AdminPage(){
  if(!await isCurrentUserAdmin())return <AdminAccess/>;
  return <AdminDashboard/>;
}
