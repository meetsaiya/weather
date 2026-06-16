import { useEffect, useState } from 'react';

const DISMISS_KEY = 'ww_install_dismissed_until';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.navigator?.standalone === true) return true; // iOS Safari
  return false;
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isSafari() {
  if (typeof navigator === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function readDismissedUntil() {
  try {
    const raw = globalThis.localStorage?.getItem(DISMISS_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

function writeDismissedUntil(ms) {
  try {
    globalThis.localStorage?.setItem(DISMISS_KEY, String(ms));
  } catch {
    // ignore
  }
}

/**
 * Renders an "Add to home screen" button on the dashboard.
 *
 * Two flavors:
 *   - Chrome / Edge / Samsung / Android: capture the `beforeinstallprompt`
 *     event and trigger it on click. Fast, native UX.
 *   - iOS Safari: no programmatic prompt exists, so we open a modal with
 *     "Tap Share → Add to Home Screen" instructions.
 *
 * Hidden when:
 *   - The app is already running as a PWA (display-mode: standalone)
 *   - The user dismissed the prompt within the last 7 days
 *   - No supported install path exists (e.g., desktop Firefox)
 */
export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [iosOpen, setIosOpen] = useState(false);
  const [genericOpen, setGenericOpen] = useState(false);
  const [dismissed, setDismissed] = useState(Date.now() < readDismissedUntil());

  useEffect(() => {
    if (installed) return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  if (installed || dismissed) return null;

  const handlePrompt = async () => {
    if (!promptEvent) return;
    try {
      promptEvent.prompt();
      await promptEvent.userChoice; // resolves with { outcome: 'accepted' | 'dismissed' }
    } catch {
      // user rejected via gesture; treat as dismissal below.
    }
    setPromptEvent(null);
  };

  const dismiss = () => {
    writeDismissedUntil(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    setDismissed(true);
  };

  // Three install paths, in order of preference:
  //   1. Native Chrome/Edge/Samsung prompt (beforeinstallprompt fired)
  //   2. iOS Safari (Share → Add to Home Screen)
  //   3. Generic instructions modal (covers desktop Chrome before its
  //      engagement heuristic fires, desktop Firefox, etc.)
  const showNativeButton = !!promptEvent;
  const showIOSPath = !promptEvent && isIOS() && isSafari();
  const showGenericPath = !promptEvent && !showIOSPath;

  return (
    <div
      className="mb-4 bg-sky-500/10 border border-sky-500/30 rounded-xl p-4"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sky-300 text-xs uppercase tracking-wide font-medium">
            Add to your home screen
          </p>
          <p className="text-slate-300 text-sm mt-1">
            One tap to open the day's brief. Works offline once installed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {showNativeButton && (
              <button
                type="button"
                onClick={handlePrompt}
                className="bg-sky-500 hover:bg-sky-400 text-white font-medium px-4 py-2 rounded-lg min-h-[44px] text-sm transition"
              >
                Install
              </button>
            )}
            {showIOSPath && (
              <button
                type="button"
                onClick={() => setIosOpen(true)}
                className="bg-sky-500 hover:bg-sky-400 text-white font-medium px-4 py-2 rounded-lg min-h-[44px] text-sm transition"
              >
                Show me how
              </button>
            )}
            {showGenericPath && (
              <button
                type="button"
                onClick={() => setGenericOpen(true)}
                className="bg-sky-500 hover:bg-sky-400 text-white font-medium px-4 py-2 rounded-lg min-h-[44px] text-sm transition"
              >
                How to install
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg min-h-[44px] text-sm transition"
            >
              Not now
            </button>
          </div>
        </div>
      </div>

      {iosOpen && <IOSInstructions onClose={() => setIosOpen(false)} />}
      {genericOpen && <GenericInstructions onClose={() => setGenericOpen(false)} />}
    </div>
  );
}

function IOSInstructions({ onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
        <header className="flex items-center justify-between mb-4">
          <h2 id="ios-install-title" className="text-lg font-semibold text-slate-100">
            Add to Home Screen
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <ol className="space-y-3 text-slate-200 text-sm">
          <li className="flex gap-3">
            <span className="bg-sky-500/20 text-sky-300 rounded-full w-7 h-7 flex items-center justify-center font-semibold shrink-0">
              1
            </span>
            <span>
              Tap the <span className="font-medium text-slate-100">Share</span> button at the
              bottom of Safari{' '}
              <span aria-hidden className="text-sky-400">
                ⬆︎
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-sky-500/20 text-sky-300 rounded-full w-7 h-7 flex items-center justify-center font-semibold shrink-0">
              2
            </span>
            <span>
              Scroll and choose <span className="font-medium text-slate-100">Add to Home Screen</span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-sky-500/20 text-sky-300 rounded-full w-7 h-7 flex items-center justify-center font-semibold shrink-0">
              3
            </span>
            <span>
              Tap <span className="font-medium text-slate-100">Add</span> — the WeatherWise icon
              lands on your home screen.
            </span>
          </li>
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 bg-sky-500 hover:bg-sky-400 text-white py-3 rounded-lg min-h-[44px] font-medium transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function GenericInstructions({ onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-instructions-title"
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
        <header className="flex items-center justify-between mb-4">
          <h2 id="install-instructions-title" className="text-lg font-semibold text-slate-100">
            Install WeatherWise
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <Section title="Chrome / Edge on Android">
          <p>
            Look for the <span className="font-medium text-slate-100">"Install app"</span> banner
            or open the menu (⋮) → <span className="font-medium text-slate-100">Install app</span>.
          </p>
        </Section>

        <Section title="Chrome / Edge on desktop">
          <p>
            Click the install icon{' '}
            <span className="inline-block bg-slate-800 px-1.5 py-0.5 rounded text-sky-300 text-xs">
              ⊕
            </span>{' '}
            at the right of the address bar, or open the menu (⋮) →{' '}
            <span className="font-medium text-slate-100">Install WeatherWise…</span>
          </p>
          <p className="text-slate-400 text-xs mt-1">
            If the icon isn't there yet, refresh the page and interact for a few seconds — Chrome
            unlocks the install option after a brief engagement check.
          </p>
        </Section>

        <Section title="Samsung Internet">
          <p>
            Menu (☰) → <span className="font-medium text-slate-100">Add page to → Home screen</span>.
          </p>
        </Section>

        <Section title="Firefox on Android">
          <p>
            Menu (⋮) → <span className="font-medium text-slate-100">Install</span>.
          </p>
        </Section>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 bg-sky-500 hover:bg-sky-400 text-white py-3 rounded-lg min-h-[44px] font-medium transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-wide text-sky-300 font-medium mb-1">{title}</p>
      <div className="text-slate-200 text-sm space-y-1">{children}</div>
    </div>
  );
}
