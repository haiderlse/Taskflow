import { ScreenShell } from '../components/ScreenShell';
import { CaptureBar } from '../components/CaptureBar';
import { LoadError } from '../components/LoadError';
import { TodayHeader } from '../components/today/TodayHeader';
import { Banners } from '../components/today/Banners';
import { PrimaryCard } from '../components/today/PrimaryCard';
import { useDay } from '../api/days';
import { useSettings } from '../api/settings';
import { useToday } from '../lib/useToday';
import { nextWorkDay, todayMode } from '../shared/exec/today';

/** What must I ship today, and what am I working on right now? (spec C "Today") */
export default function Today() {
  const { today, now, ready } = useToday();
  const settings = useSettings();
  const day = useDay(today, { enabled: ready });
  const next = settings.data ? nextWorkDay(today, settings.data.workDays) : today;
  const tomorrow = useDay(next, { enabled: ready && Boolean(day.data?.day?.shutdownAt) });
  const loaded = settings.data && day.data ? { settings: settings.data, view: day.data } : null;
  const mode = loaded ? todayMode(now, loaded.settings, loaded.view) : null;
  return (
    <ScreenShell title="Today">
      {settings.isError && <LoadError what="the schedule" error={settings.error} onRetry={() => void settings.refetch()} />}
      {day.isError && <LoadError what="today" error={day.error} onRetry={() => void day.refetch()} />}
      {!loaded && !settings.isError && !day.isError && <p className="text-ink-muted">Loading today…</p>}
      {loaded && mode && (
        <>
          <TodayHeader date={today} weekStartDay={loaded.settings.weekStartDay} week={loaded.view.week} />
          <Banners banners={mode.banners} firstWeek={!loaded.view.hasHistory} />
          <PrimaryCard mode={mode} view={loaded.view} settings={loaded.settings} tomorrow={{ date: next, mustShip: tomorrow.data?.mustShip ?? null }} />
        </>
      )}
      <div className="sticky bottom-20 pt-6 md:bottom-6">
        <CaptureBar />
      </div>
    </ScreenShell>
  );
}
