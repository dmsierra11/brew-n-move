import { supabase } from '../lib/supabase';

type Props = {
  onSession: (session: null) => void;
};

export function NotAuthorized({ onSession }: Props) {
  async function signOut() {
    await supabase.auth.signOut();
    onSession(null);
  }

  return (
    <main className="narrow">
      <h1>Not authorized</h1>
      <p>This app is limited to staff accounts with an admin role.</p>
      <button onClick={() => void signOut()} type="button">Sign out</button>
    </main>
  );
}
