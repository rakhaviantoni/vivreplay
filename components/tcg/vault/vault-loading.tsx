export function VaultLoading({ label }: { label: string }) {
  return (
    <main className="page vault-page vault-loading-page" aria-busy="true">
      <div className="vault-loading-layout" role="status" aria-label={label}>
        <header className="vault-loading-header" aria-hidden="true">
          <div><i /><i /><i /></div>
          <div><i /><i /></div>
        </header>
        <div className="vault-loading-metrics" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => <i key={index} />)}
        </div>
        <div className="vault-loading-tabs" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="vault-loading-toolbar" aria-hidden="true">
          <i className="vault-loading-search" />
          <div><i /><i /><i /></div>
        </div>
        <div className="vault-loading-slots" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="vault-loading-slot" key={index}>
              <i className="vault-loading-art" />
              <i className="vault-loading-name" />
              <i className="vault-loading-meta" />
            </div>
          ))}
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </main>
  );
}
