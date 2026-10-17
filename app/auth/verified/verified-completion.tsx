"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function VerifiedCompletion({ returnTo, signedIn, isIndonesian }: { returnTo: string; signedIn: boolean; isIndonesian: boolean }) {
  const router = useRouter();
  const signInHref = `/sign-in?return_to=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    toast.success(signedIn
      ? (isIndonesian ? "Email terverifikasi. Anda sudah masuk." : "Email verified. You’re signed in.")
      : (isIndonesian ? "Email terverifikasi. Silakan masuk untuk melanjutkan." : "Email verified. Sign in to continue."));
    const timer = window.setTimeout(() => router.replace(signedIn ? returnTo : signInHref), 1500);
    return () => window.clearTimeout(timer);
  }, [isIndonesian, returnTo, router, signInHref, signedIn]);

  return (
    <div className="auth-card-body">
      <div className="auth-success" role="status">
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800 }}>
          {isIndonesian ? "Verifikasi berhasil" : "Verification complete"}
        </div>
        <span>
          {signedIn
            ? (isIndonesian ? "Sesi Anda sudah aktif. Anda akan segera kembali." : "Your session is active. Taking you back now.")
            : (isIndonesian ? "Masuk untuk melanjutkan ke halaman sebelumnya." : "Sign in to continue to the page you came from.")}
        </span>
      </div>
      <Link className="button" href={signedIn ? returnTo : signInHref} style={{ display: "inline-flex", width: "100%", justifyContent: "center" }}>
        {signedIn
          ? (isIndonesian ? "Lanjutkan" : "Continue")
          : (isIndonesian ? "Masuk" : "Sign in")}
      </Link>
    </div>
  );
}
