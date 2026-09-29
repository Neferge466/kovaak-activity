import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DailyActivity, Metric } from '../types/activity';
import { calendarDates, formatDate, level, parseDate } from '../utils/activity';
import { useI18n } from '../i18n';
interface Props { data: DailyActivity[]; year: number; metric: Metric; today: string; }
export default function ActivityHeatmap({ data, year, metric, today }: Props) {
  const { locale, t, weekdays } = useI18n();
  const labels = { trainingMinutes: [`0 ${t('minute')}`, '1–15', '16–30', '31–60', '61–90', `90+ ${t('minute')}`], runs: [`0 ${t('runs')}`, '1–10', '11–25', '26–50', '51–100', `100+ ${t('runs')}`] };
  const [selected, setSelected] = useState<DailyActivity | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => { setSelected(null); }, [year, metric]);
  useEffect(() => {
    const dismiss = () => setSelected(null);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => { window.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', dismiss); };
  }, []);
  function show(date: DailyActivity, element: HTMLButtonElement) {
    const rect = element.getBoundingClientRect();
    const halfWidth = Math.min(280, window.innerWidth - 24) / 2;
    setPosition({ left: Math.max(halfWidth + 12, Math.min(window.innerWidth - halfWidth - 12, rect.left + rect.width / 2)), top: rect.bottom + 130 > window.innerHeight ? Math.max(12, rect.top - 125) : rect.bottom + 9 });
    setSelected(date);
  }
  const lookup = new Map(data.map(day => [day.date, day]));
  const cells = calendarDates(year).map(cell => ({ ...cell, future: cell.date > today, day: lookup.get(cell.date) }));
  const start = parseDate(cells[0].date);
  const columns = cells.length / 7;
  const months = Array.from({ length: 12 }, (_, month) => {
    const date = new Date(Date.UTC(year, month, 1));
    return { label: date.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }), column: Math.floor((date.getTime() - start.getTime()) / 86400000 / 7) + 1 };
  });
  const active = data.filter(day => day.runs > 0).length;
  const partial = data.some(day => day.coverage === 'partial');
  return <>
    <div className="heatmap-scroll" onScroll={() => setSelected(null)}>
      <div className="heatmap" style={{ '--columns': columns } as React.CSSProperties}>
        <div className="month-labels">{months.map(month => <span key={month.label} style={{ gridColumn: month.column }}>{month.label}</span>)}</div>
        <div className="weekday-labels"><span>{weekdays[0]}</span><span>{weekdays[2]}</span><span>{weekdays[4]}</span><span>{weekdays[6]}</span></div>
        <div className="cells">{cells.map(cell => {
          if (!cell.inYear) return <span key={cell.date} className="cell padding" />;
          const value = cell.day?.[metric];
          const unknownZero = cell.day?.coverage === 'partial' && value === 0;
          const status = cell.future ? t('futureDate') : unknownZero ? t('zeroPartial') : !cell.day || value === undefined ? t('noData') : `${value} ${t(metric === 'runs' ? 'runs' : 'minutes')}${cell.day.coverage ? ` · ${t('partial')}` : ''}`;
          return <button key={cell.date} className={`cell ${cell.future ? 'future' : value === undefined || unknownZero ? 'unknown' : `level-${level(value, metric)}`} ${cell.date === today ? 'today' : ''}`} aria-label={`${formatDate(cell.date, locale)}: ${status}`} aria-describedby={selected?.date === cell.date ? 'activity-tooltip' : undefined} onMouseEnter={event => show(cell.day ?? { date: cell.date, runs: 0 }, event.currentTarget)} onMouseLeave={() => setSelected(null)} onFocus={event => show(cell.day ?? { date: cell.date, runs: 0 }, event.currentTarget)} onBlur={() => setSelected(null)} onClick={event => show(cell.day ?? { date: cell.date, runs: 0 }, event.currentTarget)} onKeyDown={event => { if (event.key === 'Escape') setSelected(null); }} />;
        })}</div>
      </div>
    </div>
    <div className="heatmap-footer"><div className="legend" aria-label={t('intensity')}>{labels[metric].map((label, index) => <span key={label}><i className={`level-${index}`} />{label}</span>)}<span className="future-key"><i className="future" />{t('future')}</span>{(!data.length || partial) && <span><i className="unknown" />{t('noData')}</span>}</div><span>{data.length ? partial ? t('knownDays', { count: active }) : t('activePercent', { count: active, percent: Math.round(active / data.length * 100) }) : t('noDays')}</span></div>
    {selected && createPortal(<div id="activity-tooltip" role="tooltip" className="activity-tooltip floating-tooltip" style={{ left: position.left, top: position.top }}><strong>{formatDate(selected.date, locale)}</strong>{selected.date > today ? <span>{t('futureDate')}</span> : !lookup.has(selected.date) ? <span>{t('noHistory')}</span> : <><span>{selected.trainingMinutes === undefined ? t('timeUnavailable') : `${selected.trainingMinutes} ${t('minute')}`} · {selected.runs} {t('runs')}</span>{selected.coverage && <span>{t(selected.runs === 0 ? 'zeroPartial' : 'partial')}</span>}{(selected.newPBs !== undefined || selected.scenarioCount !== undefined) && <span>{selected.newPBs ?? '—'} {t('newPBs')} · {selected.scenarioCount ?? '—'} {t('scenarios')}</span>}</>}</div>, document.body)}
  </>;
}
