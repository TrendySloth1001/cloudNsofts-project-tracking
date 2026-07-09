'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginSchema } from '@cnsofts/shared';
import { Button, Divider, Input } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { authApi } from '../auth.api';
import { GoogleIcon } from './google-icon';
import styles from './login-form.module.css';

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
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

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
        onClick={() => setNotice('Google sign-in isn’t connected yet.')}
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

      {notice && <p className={styles.notice}>{notice}</p>}

      <p className={styles.support}>
        New to CloudNSofts?{' '}
        <Link href="/signup" className={styles.link}>
          Create an account
        </Link>
      </p>
    </div>
  );
}
