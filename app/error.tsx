'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="page"><div className="empty-state"><h1>Something didn’t load.</h1><p>Your saved changes are safe. Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></div></main>}
