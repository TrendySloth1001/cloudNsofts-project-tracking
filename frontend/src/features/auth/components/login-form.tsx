'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPaths, loginSchema } from '@cnsofts/shared';
import { Button, Divider, Input } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { config } from '@/lib/config';
import { authApi } from '../auth.api';
import { GoogleIcon } from './google-icon';
import styles from './login-form.module.css';

/** Friendly messages for OAuth failures the backend redirects back with. */
const OAUTH_ERRORS: Record<string, string> = {
  oauth_unavailable: 'Google sign-in isn’t available right now.',
  oauth_failed: 'Google sign-in didn’t complete. Please try again.',
  oauth_unverified: 'Your Google email isn’t verified.',
};

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Surface an OAuth failure the backend bounced us back with (?error=...).
  // Read from the URL directly (client-only) to avoid a Suspense boundary on
  // this statically-rendered page.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code && OAUTH_ERRORS[code]) setFormError(OAUTH_ERRORS[code]);
  }, []);

  function signInWithGoogle() {
    // Full-page redirect into the backend's OAuth start endpoint.
    window.location.href = `${config.apiUrl}${apiPaths.auth.google()}`;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await authApi.login(result.data);
      router.replace('/');
    } catch (err) {
      setSubmitting(false);
      setFormError(
        err instanceof Error ? err.message : 'Unable to sign in. Try again.',
      );
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <Logo size="sm" />
      </div>

      <div className={styles.head}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>
          Sign in to manage your projects, tasks and team.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        onClick={signInWithGoogle}
      >
        <span className={styles.google}>
          <GoogleIcon />
          Continue with Google
        </span>
      </Button>

      <Divider label="or continue with email" />

      {formError && <p className={styles.formError}>{formError}</p>}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <Input
          label="Email"
          type="email"
          inputSize="lg"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          inputSize="lg"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className={styles.forgotRow}>
          <a href="#" className={styles.forgot}>
            Forgot password?
          </a>
        </div>
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Sign in
        </Button>
      </form>

      <p className={styles.support}>
        New to CloudNSofts?{' '}
        <Link href="/signup" className={styles.link}>
          Create an account
        </Link>
      </p>

      <p className={styles.legal}>
        By continuing you agree to our{' '}
        <Link href="/terms">Terms of Service</Link> and{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
