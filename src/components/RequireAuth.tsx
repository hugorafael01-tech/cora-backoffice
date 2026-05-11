import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setAuthed(true);

      const { data, error } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', session.user.email!)
        .maybeSingle();

      setIsAdmin(!!data && !error);
      setLoading(false);
    }
    check();
  }, []);

  if (loading) return <div className="p-8">Carregando…</div>;
  if (!authed) return <Navigate to="/login" replace />;
  if (!isAdmin) return <div className="p-8">Acesso negado. Esta conta não é admin.</div>;

  return <>{children}</>;
}
