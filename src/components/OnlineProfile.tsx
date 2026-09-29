import { useState } from 'react';
import { useI18n } from '../i18n';
import type { OnlineDataset } from '../types/activity';
import { formatDate } from '../utils/activity';
import ActivityHeatmap from './ActivityHeatmap';
import { TrainingTrend } from './Charts';
export default function OnlineProfile({ dataset, players }: { dataset: OnlineDataset; players: { id: string; displayName: string }[] }) {
  const { t, language, locale, setLanguage } = useI18n();
  const [year, setYear] = useState(Number(dataset.today.slice(0, 4)));
  const currentYear = Number(dataset.today.slice(0, 4));
  const years = [...new Set([currentYear, currentYear - 1, ...dataset.daily.map(day => Number(day.date.slice(0, 4)))])].sort((a, b) => b - a);
  const data = dataset.daily.filter(day => day.date.startsWith(String(year)));
  const active = data.filter(day => day.runs > 0).length;
  const number = new Intl.NumberFormat(locale);
  const datetime = (instant: string) => new Date(instant).toLocaleString(locale, { timeZone: dataset.profile.timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const subtitle = dataset.trackingSince ? t('trackingSince', { date: datetime(dataset.trackingSince) }) : t('waitingBaseline');
  return <main className="profile-page">
    <header className="profile-header"><div className="identity"><div className="eyebrow">{t('eyebrow')}</div><h1>{dataset.profile.displayName}<span className="profile-dot" /></h1><p className="site-title">{t('title')}</p><p className="description">{t('description')}</p></div><div className="header-controls">
      <span className="demo-badge"><i />{t('online')}</span>
      {players.length > 1 && <label className="year-select"><span>{t('player')}</span><select aria-label={t('player')} value={dataset.profile.id} onChange={event => { const url = new URL(location.href); url.searchParams.set('player', event.target.value); location.assign(url); }}>{players.map(player => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label>}
      <label className="year-select"><span>{t('calendarYear')}</span><select value={year} onChange={event => setYear(Number(event.target.value))} aria-label={t('activityYear')}>{years.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="year-select language-select"><span>{t('language')}</span><select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'zh')} aria-label={t('language')}><option value="en">English</option><option value="zh">中文</option></select></label>
    </div></header>
    <div className="summary" aria-label={t('summary')}><div><strong>{data.length ? active : '—'}</strong><span>{t('knownActive')}</span></div><div><strong className="teal">{dataset.totalPlays === null ? '—' : number.format(dataset.totalPlays)}</strong><span>{t('reportedPlays')}</span></div><div><strong className="warm">{dataset.trackingSince ? number.format(dataset.sampledPlays) : '—'}</strong><span>{t('observedPlays')}</span></div><div><strong className="lilac">—</strong><span>{t('training')}</span></div></div>
    <div className="data-notice"><p>{subtitle} · {dataset.profile.timezone}</p><p>{t('onlineNotice')}</p>{dataset.unassignedPlays > 0 && <p>{t('crossDay', { count: dataset.unassignedPlays })}</p>}{dataset.counterResets > 0 && <p>{t('resets')}</p>}</div>
    <section className="panel activity-panel"><div className="section-heading"><div><h2>{t('activity')}</h2><p>{t('observedPlays')} · {year}</p></div><span className="metric-label">Plays</span></div><ActivityHeatmap data={data} year={year} metric="runs" today={dataset.today}/></section>
    <div className="module-grid"><section className="panel"><div className="section-heading"><div><h2>{t('trend')}</h2><p>{t('sampleTrend')}</p></div></div><TrainingTrend data={data} metric="runs"/></section>
      <section className="panel focus-panel"><div className="section-heading"><div><h2>{t('focus')}</h2><p>{t('last30')} · {t('observedPlays')}</p></div></div><div className="scenario-list">{dataset.focus.length ? dataset.focus.map((scenario, index) => <div className={`scenario-row accent-${index}`} key={scenario.id}><div className="scenario-meta"><span>{scenario.scenarioName}</span><strong>{number.format(scenario.runs)} <small>Plays</small></strong></div><div className="scenario-bottom"><div className="bar-track"><div style={{ width: `${scenario.runs / dataset.focus[0].runs * 100}%` }}/></div></div></div>) : <p className="empty-note">{t('focusWaiting')}</p>}</div></section>
      <section className="panel progress-panel"><div className="section-heading"><div><h2>{t('progress')}</h2><p>{t('pbSubtitle')}</p></div></div>{dataset.pbEvents.length ? <div>{dataset.pbEvents.map(event => <div className="pb-row" key={`${event.timestamp}:${event.scenarioId}`}><span>{event.scenarioName}<small>{datetime(event.timestamp)}</small></span><strong className="teal">{number.format(event.score)}</strong></div>)}</div> : <p className="empty-note">{t('pbWaiting')}</p>}<p className="empty-note">{t('progressMissing')}</p></section>
      <section className="panel pattern-panel"><div className="section-heading"><div><h2>{t('pattern')}</h2><p>{t('last30')}</p></div></div><p className="empty-note">{t('patternWaiting')}</p><div className="pattern-stats"><div><strong>—</strong><span>{t('minute')} {t('perActive')}</span></div><div><strong>—</strong><span>{t('peak')}</span></div></div></section>
    </div>
    <footer><span>{dataset.updatedAt ? t('updated', { date: datetime(dataset.updatedAt) }) : subtitle}</span><span><a href="?demo=1">{t('demoLink')}</a> <span className="footer-divider">/</span> KovaaK Activity</span></footer>
    <span className="sr-only">{formatDate(dataset.today, locale)}</span>
  </main>;
}
