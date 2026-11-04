'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, getJson, postJson } from '@/lib/api';
import type { LiveState } from '@/lib/server/liveRooms';

export type LiveAction =
  | { action: 'say'; text: string }
  | { action: 'release'; mode: 'waitlist' | 'youth' }
  | { action: 'keep' }
  | { action: 'respond'; fanId: string; accept: boolean }
  | { action: 'reset'; language?: 'en' | 'de' };

/**
 * Subscribes to a live room over Server-Sent Events and falls back to
 * polling when a proxy or host doesn't support streaming.
 */
export function useLiveRoom(room: string) {
  const [state, setState] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const version = useRef(-1);

  const apply = useCallback((s: LiveState) => {
    if (s.version < version.current) return;
    version.current = s.version;
    setState(s);
  }, []);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined;
    let failures = 0;
    const es = new EventSource(`/api/live/${room}/stream`);
    const startPolling = () => {
      setConnection('polling');
      const tick = () =>
        getJson<LiveState>(`/api/live/${room}`)
          .then(apply)
          .catch((e) => setError(errorMessage(e)));
      void tick();
      poll = setInterval(tick, 2000);
    };
    es.onmessage = (e) => {
      failures = 0;
      setConnection('live');
      setError(null);
      apply(JSON.parse(e.data) as LiveState);
    };
    es.onerror = () => {
      failures++;
      if (failures >= 3 && !poll) {
        es.close();
        startPolling();
      }
    };
    return () => {
      es.close();
      if (poll) clearInterval(poll);
    };
  }, [room, apply]);

  const send = useCallback(
    async (action: LiveAction) => {
      setBusy(true);
      setError(null);
      try {
        apply(await postJson<LiveState>(`/api/live/${room}`, action));
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [room, apply],
  );

  return { state, connection, error, busy, send };
}
