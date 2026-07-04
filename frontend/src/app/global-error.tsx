'use client';

/**
 * Root error boundary. This replaces the root layout entirely when the layout
 * itself throws, so the app's CSS/design tokens are not guaranteed to be
 * loaded here — hence the minimal inline styling (the sanctioned exception to
 * the tokens-only rule, since no stylesheet can be relied upon at this point).
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: '#555', maxWidth: 420 }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 8,
            height: 40,
            padding: '0 20px',
            borderRadius: 8,
            border: 'none',
            background: '#6d5efc',
            color: '#fff',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
