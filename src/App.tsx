import { useMemo, useState } from 'react';
import ActivityHeatmap from './components/ActivityHeatmap';
import { Sparkline, TrainingTrend } from './components/Charts';
import { demoToday, mockActivity, profile, scenarios } from './data/mock';
import type { Metric } from './types/activity';
import { formatDate, parseDate, summarize } from './utils/activity';
import { useI18n } from './i18n';

function SectionTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>;
}
export default function App() {
  const { language, locale, setLanguage, t, weekdays } = useI18n();
  const number = new Intl.NumberFormat(locale);
  const decimal = (value: number) => number.format(Math.round(value * 10) / 10);
  const [year, setYear] = useState(2026);
  const [metric, setMetric] = useState<Metric>('trainingMinutes');
  const data = useMemo(() => year === 2024 ? [] : mockActivity(year), [year]);
  const summary = summarize(data);
  const recent = data.slice(-30);
  const recentSummary = summarize(recent);
  const weekdayMinutes = Array.from({ length: 7 }, (_, day) => recent.filter(d => (parseDate(d.date).getUTCDay() + 6) % 7 === day).reduce((sum, d) => sum + (d.trainingMinutes ?? 0), 0));
  const hasData = data.length > 0;
  return <main className="profile-page">
    <header className="profile-header">
      <div className="identity"><div className="eyebrow">{t('eyebrow')}</div><h1>{profile.displayName}<span className="profile-dot" /></h1><p className="site-title">{t('title')}</p><p className="description">{t('description')}</p></div>
      <div className="header-controls">
        <span className="demo-badge"><i />{t('demo')}</span>
        <label className="year-select"><span>{t('calendarYear')}</span><select value={year} onChange={event => setYear(Number(event.target.value))} aria-label={t('activityYear')}><option>2026</option><option>2025</option><option>2024</option></select></label>
        <label className="year-select language-select"><span>{t('language')}</span><select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'zh')} aria-label={t('language')}><option value="en">English</option><option value="zh">中文</option></select></label>
      </div>
    </header>
    <div className="summary" aria-label={t('summary')}>
      <div><strong>{number.format(summary.active)}</strong><span>{t('activeDays')}</span></div>
      <div><strong className="teal">{number.format(Math.round(summary.minutes / 60))}<small> {t('hour')}</small></strong><span>{t('training')}</span></div>
      <div><strong className="warm">{summary.streak}</strong><span>{t(year === 2026 ? 'currentStreak' : 'yearEndStreak')}</span></div>
      <div><strong className="lilac">{number.format(summary.runs)}</strong><span>{t('runsLabel')}</span></div>
    </div>
    <section className="panel activity-panel">
      <SectionTitle title={t('activity')} subtitle={t('activitySubtitle', { year })}><div className="segmented" aria-label={t('metric')}><button className={metric === 'trainingMinutes' ? 'selected' : ''} onClick={() => setMetric('trainingMinutes')} aria-pressed={metric === 'trainingMinutes'}>{t('time')}</button><button className={metric === 'runs' ? 'selected' : ''} onClick={() => setMetric('runs')} aria-pressed={metric === 'runs'}>{t('runsLabel')}</button></div></SectionTitle>
      <ActivityHeatmap data={data} year={year} metric={metric} today={demoToday}/>
      {!hasData && <p className="empty-note">{t('noActivity', { year })}</p>}
    </section>
    <div className="module-grid">
      <section className="panel"><SectionTitle title={t('trend')} subtitle={`${t(metric === 'runs' ? 'weeklyRuns' : 'weeklyTime')} · ${year}`}/><TrainingTrend data={data} metric={metric}/></section>
      <section className="panel focus-panel"><SectionTitle title={t('focus')} subtitle={t('last30')}/><div className="scenario-list">{hasData ? scenarios.map((scenario, index) => <div className={`scenario-row accent-${index}`} key={scenario.id}><div className="scenario-meta"><span>{scenario.scenarioName}</span><strong>{decimal(scenario.trainingMinutes / 60)} <small>{t('hour')}</small></strong></div><div className="scenario-bottom"><div className="bar-track"><div style={{ width: `${scenario.trainingMinutes / scenarios[0].trainingMinutes * 100}%` }}/></div><span>{scenario.runs} {t('runs')}</span></div></div>) : <p className="empty-note">{t('noScenarios')}</p>}</div></section>
      <section className="panel progress-panel"><SectionTitle title={t('progress')} subtitle={t('progressSubtitle')}/>{hasData ? <div className="progress-list">{scenarios.map(scenario => <div className="progress-row" key={scenario.id}><span className="scenario-name">{scenario.scenarioName}</span><strong>{number.format(scenario.scores.at(-1)!)}</strong><span className="gain">+{decimal((scenario.scores.at(-1)! / scenario.scores[0] - 1) * 100)}%</span><Sparkline values={scenario.scores} name={scenario.scenarioName}/></div>)}</div> : <p className="empty-note">{t('noScores')}</p>}</section>
      <section className="panel pattern-panel"><SectionTitle title={t('pattern')} subtitle={t('last30')}/>{hasData ? <>
        <div className="pattern-stats"><div><strong className="teal">{decimal(recentSummary.active / recent.length * 7)}</strong><span>{t('daysWeek')}</span></div><div><strong>{Math.round(recentSummary.minutes / Math.max(recentSummary.active, 1))}<small> {t('minute')}</small></strong><span>{t('perActive')}</span></div><div><span>{t('peak')}</span><strong className="warm peak">20:00–23:00</strong><span className="tiny">{t('illustrative')} · {profile.timezone}</span></div></div>
        <div className="weekday-chart" role="img" aria-label={t('weekdayChart')}>{weekdays.map((day, index) => <div key={day}><div className="weekday-bar-space"><span style={{ height: `${weekdayMinutes[index] / Math.max(...weekdayMinutes, 1) * 100}%` }} title={`${day}: ${weekdayMinutes[index]} ${t('minute')}`}/></div><span>{day}</span></div>)}</div>
      </> : <p className="empty-note">{t('noPattern')}</p>}</section>
    </div>
    <footer><span><span className="footer-mark">↗</span> {t('footer')} <span className="footer-divider">/</span> <a href="./">{t('liveLink')}</a></span><span>{t('mock')} · {year === 2026 ? t('asOf', { date: formatDate(demoToday, locale) }) : year} <span className="footer-divider">/</span> KovaaK Activity</span></footer>
  </main>;
}
