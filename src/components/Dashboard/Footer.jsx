// Subtle attribution footer at the bottom of the dashboard. Links out to the
// author's LinkedIn. Intentionally small + muted — context, not branding.
export default function Footer() {
  return (
    <footer className="mt-8 pb-2 text-center text-[11px] text-slate-500">
      Built by{' '}
      <a
        href="https://www.linkedin.com/in/meetsaiya"
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-400 hover:text-sky-400 underline-offset-2 hover:underline transition"
      >
        Meet Saiya
      </a>
    </footer>
  );
}
