import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

type Props = {
  onSession: (session: Session | null) => void;
  session: Session | null;
};

export function SignIn({ onSession, session }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) {
    return <Navigate to="/reward-budgets" replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError || !data.session) {
      setError('Sign-in failed.');
      return;
    }
    onSession(data.session);
  }

  return (
    <main className="narrow">
      <h1>Brew &amp; Move admin</h1>
      <p>Staff sign-in. Members cannot open Reward Budgets.</p>
      <form onSubmit={submit}>
        <label>
          Email
          <input autoComplete="username" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
        </label>
        <label>
          Password
          <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button disabled={busy} type="submit">Sign in</button>
      </form>
    </main>
  );
}
