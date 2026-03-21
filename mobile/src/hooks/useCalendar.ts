import { useState, useEffect, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../api/client';
import { mealWindowsFromEvents, windowsToBlocks, eventsToClassBlocks } from '../utils/mealWindows';
import type { EatingWindow, TimelineBlock } from '../types';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface UseCalendarResult {
  status: 'loading' | 'connected' | 'disconnected';
  timelineBlocks: TimelineBlock[];
  eatingWindows: EatingWindow[];
  nextEventTitle: string | undefined;
  connect: (token: string, backendUrl: string) => void;
  refresh: () => Promise<void>;
}

export function useCalendar(): UseCalendarResult {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [timelineBlocks, setTimelineBlocks] = useState<TimelineBlock[]>([]);
  const [eatingWindows, setEatingWindows] = useState<EatingWindow[]>([]);
  const [nextEventTitle, setNextEventTitle] = useState<string | undefined>(undefined);

  const fetchEvents = useCallback(async () => {
    const { data } = await api.get('/calendar/events');
    const events: CalendarEvent[] = data.events ?? [];
    const windows = mealWindowsFromEvents(events);
    const classBlocks = eventsToClassBlocks(events);
    const mealBlocks = windowsToBlocks(windows);
    const all = [...classBlocks, ...mealBlocks].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    setTimelineBlocks(all);
    setEatingWindows(windows);

    const now = new Date();
    const next = events
      .filter(e => new Date(e.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
    setNextEventTitle(next?.title);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { data } = await api.get('/calendar/status');
        if (cancelled) return;
        if (data.connected) {
          await fetchEvents();
          if (!cancelled) setStatus('connected');
        } else {
          setTimelineBlocks([]);
          setEatingWindows([]);
          setStatus('disconnected');
        }
      } catch {
        if (!cancelled) {
          setTimelineBlocks([]);
          setEatingWindows([]);
          setStatus('disconnected');
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback((token: string, backendUrl: string) => {
    const url = `${backendUrl.replace(/\/$/, '')}/calendar/connect-init?token=${encodeURIComponent(token)}`;
    WebBrowser.openBrowserAsync(url);
  }, []);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.get('/calendar/status');
      if (data.connected) {
        await fetchEvents();
        setStatus('connected');
      } else {
        setTimelineBlocks([]);
        setEatingWindows([]);
        setStatus('disconnected');
      }
    } catch {
      setTimelineBlocks([]);
      setEatingWindows([]);
      setStatus('disconnected');
    }
  }, [fetchEvents]);

  return { status, timelineBlocks, eatingWindows, nextEventTitle, connect, refresh };
}
