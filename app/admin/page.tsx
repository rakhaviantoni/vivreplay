import {AdminDashboard} from '@/components/admin/admin-dashboard';
import {AdminAccess} from '@/components/admin/admin-access';
import {AdminWorkspace} from '@/components/admin/admin-workspace';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

export const dynamic='force-dynamic';

const sections=['overview','customers','catalog','policy','payments','marketplace','feedback','traffic','payouts','disputes','operations'] as const;
type Section=typeof sections[number];

export default async function AdminPage({searchParams}:{searchParams:Promise<{section?:string|string[]}>}){
  if(!await isCurrentUserAdmin())return <AdminAccess/>;
  const requested=(await searchParams).section;
  const section=(typeof requested==='string'&&sections.includes(requested as Section)?requested:'overview') as Section;
  return <AdminWorkspace active={section}><AdminDashboard key={section} initialSection={section}/></AdminWorkspace>;
}
