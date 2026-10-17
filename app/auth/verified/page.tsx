import { VivreMark } from "@/components/tcg/brand-assets";
import { getCurrentUser } from "@/lib/server/auth";
import { VerifiedCompletion } from "./verified-completion";

function safeReturnTo(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/api/") ? value : "/market";
}

export default async function VerifiedPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.return_to);
  const account = await getCurrentUser().catch(() => null);
  const isIndonesian = returnTo.startsWith("/id/");

  return (
    <main className="page auth-page">
      <section className="auth-card">
        <header className="auth-card-heading">
          <span className="dialog-mark"><VivreMark size={28} /></span>
          <p className="eyebrow">VIVREPLAY ACCOUNT</p>
          <h1>{isIndonesian ? "Email terverifikasi" : "Email verified"}</h1>
          <p className="auth-description">{isIndonesian ? "Konfirmasi alamat email Anda." : "Confirm your email address."}</p>
        </header>
        <VerifiedCompletion returnTo={returnTo} signedIn={Boolean(account)} isIndonesian={isIndonesian}/>
      </section>
    </main>
  );
}
