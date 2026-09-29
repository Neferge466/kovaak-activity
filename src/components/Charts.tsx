import type { DailyActivity, Metric } from '../types/activity';
import { formatDate, weeklyRanges } from '../utils/activity';
import { useI18n } from '../i18n';
function coordinates(values: number[], width: number, height: number, max: number, min = 0) {
  return values.map((value, index) => `${index / Math.max(values.length - 1, 1) * width},${height - (value - min) / Math.max(max - min, 1) * height}`).join(' ');
}
export function Sparkline({ values, name }: { values: number[]; name: string }) {
  const { t } = useI18n();
  const points = coordinates(values, 120, 30, Math.max(...values), Math.min(...values));
  return <svg className="sparkline" viewBox="-2 -3 124 36" role="img" aria-label={t('scoreRange', { name, first: values[0], last: values.at(-1)! })}><polygon points={`0,30 ${points} 120,30`} fill="rgba(113,170,161,.08)" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
export function TrainingTrend({ data, metric, year = Number(data[0]?.date.slice(0, 4)), through = `${year}-12-31` }: { data: DailyActivity[]; metric: Metric; year?: number; through?: string }) {
  const { t, locale } = useI18n();
  const weeks = weeklyRanges(data, metric, year, through);
  const values = weeks.map(week => week.value);
  const step = metric === 'runs' ? Math.max(10, 10 ** Math.floor(Math.log10(Math.max(10, ...values)))) : 4;
  const max = Math.max(step, Math.ceil(Math.max(0, ...values) / step) * step);
  const firstTime = Date.parse(weeks[0]?.date ?? '2000-01-01');
  const span = Math.max(7 * 86400000, Date.parse(weeks.at(-1)?.date ?? '2000-01-01') - firstTime);
  const x = (date: string) => (Date.parse(date) - firstTime) / span * 600;
  const groups: typeof weeks[] = [];
  for (const week of weeks) {
    const previous = groups.at(-1)?.at(-1);
    if (!previous || Date.parse(week.date) - Date.parse(previous.date) > 7 * 86400000) groups.push([]);
    groups.at(-1)!.push(week);
  }
  return <div className="trend"><svg viewBox="0 0 660 200" role="img" aria-label={t(metric === 'runs' ? 'weeklyRuns' : 'weeklyHours')}>
    <defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#71aaa1" stopOpacity=".22"/><stop offset="100%" stopColor="#71aaa1" stopOpacity="0"/></linearGradient></defs>
    {[0, 1, 2, 3].map(index => <g key={index}><text x="0" y={20 + index * 145 / 3 + 4}>{Math.round(max * (1 - index / 3))}{metric === 'trainingMinutes' ? ' h' : ''}</text><line x1="42" x2="642" y1={20 + index * 145 / 3} y2={20 + index * 145 / 3}/></g>)}
    {values.length > 0 && <g transform="translate(42,20)">{groups.map(group => { const points = group.map(week => `${x(week.date)},${145 - week.value / max * 145}`).join(' '); return <g key={group[0].date}><polygon points={`${x(group[0].date)},145 ${points} ${x(group.at(-1)!.date)},145`} fill="url(#trend-fill)"/><polyline points={points} fill="none" stroke="#71aaa1" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/></g>; })}{weeks.map(week => <circle key={week.date} cx={x(week.date)} cy={145 - week.value / max * 145} r="4" fill="#71aaa1"><title>{formatDate(week.startDate, locale)} – {formatDate(week.endDate, locale)}: {week.value.toFixed(metric === 'runs' ? 0 : 1)} {t(metric === 'runs' ? 'runs' : 'hours')} · {t('weeklyTotal')}</title></circle>)}</g>}
    {weeks.filter((_, index) => index % 8 === 0).map(week => <text key={week.date} x={42 + x(week.date)} y="194">{new Date(`${week.startDate}T00:00:00Z`).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })}</text>)}
  </svg>{data.length === 0 && <span className="chart-empty">{t('noTrend')}</span>}</div>;
}
