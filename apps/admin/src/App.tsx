import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import './App.css';

import { supabase } from './lib/supabase';
import { BudgetDetail } from './pages/BudgetDetail';
import { BudgetList } from './pages/BudgetList';
import { BudgetNew } from './pages/BudgetNew';
import { NotAuthorized } from './pages/NotAuthorized';
import { SignIn } from './pages/SignIn';

function isAdmin(session: Session | null) {
  return session?.user.app_metadata?.role === 'admin';
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return <main><p>Loading…</p></main>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SignIn onSession={setSession} session={session} />} path="/" />
        <Route
          element={
            !session ? <Navigate to="/" replace /> : isAdmin(session) ? <BudgetList onSession={setSession} session={session} /> : <NotAuthorized onSession={setSession} />
          }
          path="/reward-budgets"
        />
        <Route
          element={
            !session ? <Navigate to="/" replace /> : isAdmin(session) ? <BudgetNew session={session} /> : <NotAuthorized onSession={setSession} />
          }
          path="/reward-budgets/new"
        />
        <Route
          element={
            !session ? <Navigate to="/" replace /> : isAdmin(session) ? <BudgetDetail session={session} /> : <NotAuthorized onSession={setSession} />
          }
          path="/reward-budgets/:id"
        />
        <Route element={<Navigate to={session ? '/reward-budgets' : '/'} replace />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
