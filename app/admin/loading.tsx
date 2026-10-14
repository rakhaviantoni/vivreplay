import {AdminWorkspace} from '@/components/admin/admin-workspace';

export default function AdminLoading(){
  return <AdminWorkspace active="overview"><main className="page admin-health admin-route-loading" role="status" aria-label="Loading admin">
    <header className="admin-health-heading">
      <div><p className="eyebrow">VIVREPLAY ADMIN</p><h1>Opening dashboard</h1><p>Checking access and loading your workspace.</p></div>
    </header>
    <div className="admin-overview-loading"><i/><i/><i/><i/></div>
  </main></AdminWorkspace>;
}
