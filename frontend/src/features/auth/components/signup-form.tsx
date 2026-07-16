'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPaths, signupSchema } from '@cnsofts/shared';
import { Button, Divider, Input } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { config } from '@/lib/config';
import { authApi } from '../auth.api';
import { invalidatePrincipal } from '../use-permissions';
import { GoogleIcon } from './google-icon';
import styles from './login-form.module.css';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
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

    const result = signupSchema.safeParse({ name, email, password });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await authApi.signup(result.data);
      invalidatePrincipal();
      // Fresh accounts go through onboarding (avatar → profile → invites).
      router.replace('/onboarding');
    } catch (err) {
      setSubmitting(false);
      setFormError(
        err instanceof Error ? err.message : 'Could not create your account.',
      );
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <Logo size="sm" />
      </div>

      <div className={styles.head}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>
          Join CloudNSofts to track projects, tasks and your team.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        onClick={() => {
          window.location.href = `${config.apiUrl}${apiPaths.auth.google()}`;
        }}
      >
        <span className={styles.google}>
          <GoogleIcon />
          Continue with Google
        </span>
      </Button>

      <Divider label="or sign up with email" />

      {formError && <p className={styles.formError}>{formError}</p>}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <Input
          label="Full name"
          inputSize="lg"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoComplete="name"
          autoFocus
        />
        <Input
          label="Email"
          type="email"
          inputSize="lg"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          inputSize="lg"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Create account
        </Button>
      </form>

      {notice && <p className={styles.notice}>{notice}</p>}

      <p className={styles.support}>
        Already have an account?{' '}
        <Link href="/login" className={styles.link}>
          Sign in
        </Link>
      </p>

      <p className={styles.legal}>
        By creating an account you agree to our{' '}
        <Link href="/terms">Terms of Service</Link> and{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
