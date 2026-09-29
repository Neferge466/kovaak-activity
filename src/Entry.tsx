import { useEffect, useState } from 'react';
import DemoProfile from './App';
import OnlineProfile from './components/OnlineProfile';
import type { OnlineDataset } from './types/activity';
import { useI18n } from './i18n';
export default function Entry() {
  const { t } = useI18n();
  const [dataset, setDataset] = useState<OnlineDataset | null>(null);
  const [players, setPlayers] = useState<{ id: string; displayName: string }[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    let pending = false;
    setError(false); setDataset(null);
    const base = import.meta.env.BASE_URL;
    async function json(path: string) {
      const response = await fetch(`${base}data/${path}`, { signal: controller.signal, cache: 'no-cache' });
      if (!response.ok) throw new Error(`Static data: ${response.status}`);
      return response.json();
    }
    async function refresh() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try {
      const manifest = await json('manifest.json');
      if (!Array.isArray(manifest.players) || !manifest.players.length || manifest.players.some((p: { id: string }) => !/^[a-z0-9][a-z0-9_-]*$/.test(p.id))) throw new Error('Invalid manifest');
      const id = new URLSearchParams(location.search).get('player') ?? manifest.players[0].id;
      if (!manifest.players.some((p: { id: string }) => p.id === id)) throw new Error('Unknown player');
      const result = await json(`players/${id}.json`);
      if (result.schemaVersion !== 1 || result.source !== 'online' || result.profile?.id !== id || !Array.isArray(result.daily) || !Array.isArray(result.pbEvents) || !Array.isArray(result.focus)) throw new Error('Invalid player data');
      if (!controller.signal.aborted) { setPlayers(manifest.players); setDataset(result); }
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { pending = false; }
    }
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [demo, retry]);
  if (demo) return <DemoProfile />;
  if (!dataset) return <main className="profile-page"><p className="empty-note" role={error ? 'alert' : 'status'}>{t(error ? 'loadError' : 'loading')}</p>{error && <button className="retry-button" onClick={() => setRetry(value => value + 1)}>{t('retry')}</button>}</main>;
  return <OnlineProfile dataset={dataset} players={players} />;
}
