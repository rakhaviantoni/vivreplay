import {AdminEmailsDashboard} from '@/components/admin/admin-emails-dashboard';
import {AdminAccess} from '@/components/admin/admin-access';
import {AdminWorkspace} from '@/components/admin/admin-workspace';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

export const dynamic='force-dynamic';

export default async function AdminEmailsPage(){
  if(!await isCurrentUserAdmin())return <AdminAccess/>;
  return <AdminWorkspace active="emails"><AdminEmailsDashboard/></AdminWorkspace>;
}
