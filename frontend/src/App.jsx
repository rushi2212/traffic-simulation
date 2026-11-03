import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Check, ChevronDown, CircleHelp, Clock3, Download, Gauge, GitBranch, Layers3, Map, Pause, Play, Radio, RotateCcw, Settings2, TrafficCone, Truck, Waves } from 'lucide-react'

const initial = { vehicles: 120, duration_s: 240, signal_cycle_s: 60, arterial_lanes: 2, local_lanes: 1, flyover: true, seed: 7 }
const presets = {
  'City baseline': initial,
  'Rush hour': { vehicles: 360, duration_s: 360, signal_cycle_s: 90, arterial_lanes: 2, local_lanes: 1, flyover: true, seed: 21 },
  'Flyover closed': { vehicles: 240, duration_s: 360, signal_cycle_s: 60, arterial_lanes: 2, local_lanes: 1, flyover: false, seed: 12 },
  'Capacity upgrade': { vehicles: 360, duration_s: 360, signal_cycle_s: 45, arterial_lanes: 4, local_lanes: 2, flyover: true, seed: 31 },
}
const fmtTime = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`

function NetworkMap({ frame, result }) {
  const nodes = result?.nodes || [], edges = result?.edges || [], cars = frame?.cars || []
  const W = 760, H = 430, margin = { x: 52, y: 44 }, sx = x => margin.x + x * (W - 2 * margin.x), sy = y => margin.y + y * (H - 2 * margin.y)
  const nodeBy = Object.fromEntries(nodes.map(n => [n.id, n]))
  const densityBy = Object.fromEntries((frame?.density || []).map(d => [d.edge, d]))
  const signalBy = Object.fromEntries((frame?.signals || []).map(s => [s.node, s.state]))
  const congestionColor = edge => {
    const ratio = densityBy[edge.id]?.utilization || 0
    return ratio > .72 ? '#e26059' : ratio > .42 ? '#e8a33d' : '#4d83dc'
  }
  return <svg className="network" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Road network traffic simulation map">
    <defs>
      <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#e6edf3" strokeWidth="1"/></pattern>
      <filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity=".16"/></filter>
    </defs>
    <rect width={W} height={H} fill="url(#grid)"/>
    {edges.filter(e => !e.flyover).map(e => { const a = nodeBy[e.from], b = nodeBy[e.to]; return <g key={e.id}>
      <line x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke="#cbd5df" strokeWidth={10 + e.lanes * 6} strokeLinecap="round"/>
      <line className="road-flow" x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke={congestionColor(e)} strokeWidth="2.1" strokeDasharray="5 8" strokeLinecap="round" opacity=".98"/>
    </g> })}
    {edges.filter(e => e.flyover).map(e => { const a = nodeBy[e.from], b = nodeBy[e.to]; return <g key={e.id}>
      <line x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke="#f7e3c9" strokeWidth="30" strokeLinecap="round"/>
      <line x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke="#d88938" strokeWidth="18" strokeLinecap="round"/>
      <line className="road-flow flyover-flow" x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke="#fff2d9" strokeWidth="1.8" strokeDasharray="5 7"/>
      <rect x={sx(.60)-39} y={sy(.325)-11} width="78" height="20" rx="5" fill="#fff9ef" stroke="#dca65f"/><text x={sx(.60)} y={sy(.325)+3} textAnchor="middle" className="bridge-label">OVERPASS · F1</text>
    </g> })}
    {nodes.map(n => <g key={n.id}>
      <circle cx={sx(n.x)} cy={sy(n.y)} r="14" fill="#fff" stroke="#7c8da0" strokeWidth="1.4"/>
      <circle cx={sx(n.x)} cy={sy(n.y)} r="3.6" fill={n.signal ? '#e8a33d' : '#8394a6'}/>
      <text x={sx(n.x)} y={sy(n.y)-22} textAnchor="middle" className="node-label">{n.id}</text>
      {n.signal && <g transform={`translate(${sx(n.x)+15} ${sy(n.y)-20})`} filter="url(#shadow)"><rect width="15" height="34" rx="5" fill="#28384b" stroke="#172435" strokeWidth="1"/><circle cx="7.5" cy="9" r="4" fill={signalBy[n.id] === 'red' ? '#f24d4d' : '#685052'}/><circle cx="7.5" cy="25" r="4" fill={signalBy[n.id] === 'green' ? '#29bd75' : '#3b5b4c'}/></g>}
    </g>)}
    {cars.map(c => { const normal = (c.lane - (c.lanes - 1) / 2) * 4.2, rad = c.heading * Math.PI / 180, x = sx(c.x) - Math.sin(rad) * normal, y = sy(c.y) + Math.cos(rad) * normal, palette = ['#4279df', '#16a6a1', '#8462cb', '#df7551', '#3d9ed0']; return <g key={c.id} className="vehicle-marker" transform={`translate(${x} ${y}) rotate(${c.heading})`} filter="url(#shadow)">
      <rect x="-10" y="-5" width="20" height="10" rx="4" fill={c.waiting ? '#f0a52f' : palette[c.id % palette.length]} stroke="#fff" strokeWidth="1.2"/><rect x="-3" y="-3.5" width="7" height="7" rx="2" fill="#203047" opacity=".9"/><path d="M8 -2.7l2 1v3.4l-2 1" fill="#fff0b7"/><path d="M-8 -2.5l-1.7 1v3l1.7 1" fill="#f24d4d"/>
    </g> })}
    <g transform="translate(22 24)"><circle r="4" fill="#29bd75"/><text x="10" y="3" className="map-key">Signal green</text><circle cx="103" r="4" fill="#f24d4d"/><text x="112" y="3" className="map-key">Signal red</text><rect x="206" y="-4" width="12" height="8" rx="3" fill="#4279df"/><text x="224" y="3" className="map-key">Moving</text><rect x="278" y="-4" width="12" height="8" rx="3" fill="#f0a52f"/><text x="296" y="3" className="map-key">Queued</text></g>
  </svg>
}

function App() {
  const [settings, setSettings] = useState(initial), [health, setHealth] = useState(false), [result, setResult] = useState(null)
  const [frameIndex, setFrameIndex] = useState(0), [playing, setPlaying] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    let mounted = true
    async function launchDefault() {
      try {
        const healthResponse = await fetch('/api/health')
        const healthData = await healthResponse.json()
        if (!mounted) return
        const online = healthResponse.ok && healthData.status === 'ok'
        setHealth(online)
        if (!online) return
        const response = await fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(initial) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Could not load the sample traffic run.')
        if (mounted) { setResult(data); setFrameIndex(0); setPlaying(true) }
      } catch (e) { if (mounted) { setHealth(false); setError(e.message || 'Start the API to load the simulation.') } }
    }
    launchDefault()
    return () => { mounted = false }
  }, [])
  const frame = result?.frames?.[frameIndex], totalFrames = result?.frames?.length || 0
  const signalCounts = (frame?.signals || []).reduce((acc, signal) => { acc[signal.state] = (acc[signal.state] || 0) + 1; return acc }, {})
  useEffect(() => {
    if (!playing || !totalFrames) return
    const id = setInterval(() => setFrameIndex(i => { if (i >= totalFrames - 1) { setPlaying(false); return i } return i + 1 }), 140)
    return () => clearInterval(id)
  }, [playing, totalFrames])
  function update(key, value) {
    setSettings(s => ({ ...s, [key]: value })); setResult(null); setFrameIndex(0); setPlaying(false); setError('')
  }
  function applyPreset(name) {
    setSettings({ ...presets[name] }); setResult(null); setFrameIndex(0); setPlaying(false); setError('')
  }
  async function run() {
    setBusy(true); setError(''); setPlaying(false)
    try {
      const r = await fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      const data = await r.json(); if (!r.ok) throw new Error(data.detail || 'Simulation failed')
      setResult(data); setFrameIndex(0); setPlaying(true)
    } catch (e) { setError(e.message || 'Could not reach the simulation API.') }
    finally { setBusy(false) }
  }
  function exportCsv() {
    if (!result) return
    const escape = v => `"${String(v ?? '').replaceAll('"', '""')}"`
    const rows = [
      ['Flowstate traffic simulation'], ['Demand', result.metrics.demand], ['Completed trips', result.metrics.completed],
      ['Average trip seconds', result.metrics.avg_trip_s], ['Average speed km/h', result.metrics.avg_speed_kmh],
      ['Peak queue', result.metrics.max_queue], ['Vehicle km', result.metrics.vehicle_km],
      ['Estimated CO2 kg (distance proxy)', result.metrics.estimated_co2_kg], [],
      ['Time seconds', 'Active agents', 'Queued agents', 'Mean moving speed km/h', 'Peak link use percent'],
      ...result.frames.map(f => [f.time_s, f.cars.length, f.queue,
        f.cars.length ? (f.cars.reduce((sum, c) => sum + c.speed_kmh, 0) / f.cars.length).toFixed(1) : 0,
        (Math.max(0, ...f.density.map(d => d.utilization)) * 100).toFixed(1)])
    ]
    const blob = new Blob([rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = `flowstate-run-seed-${settings.seed}.csv`; link.click(); URL.revokeObjectURL(url)
  }
  const queueSeries = useMemo(() => result?.frames?.map(f => f.queue) || [], [result])
  const queuePath = useMemo(() => {
    if (!queueSeries.length) return ''
    const max = Math.max(1, ...queueSeries)
    return queueSeries.map((v, i) => `${(i / (queueSeries.length - 1 || 1)) * 100},${40 - (v / max) * 34}`).join(' ')
  }, [queueSeries])
  const setNum = key => e => update(key, Number(e.target.value))

  return <div className="app"><aside className="side">
    <div className="logo"><div className="logo-icon"><Waves size={19}/></div><span>flowstate</span><em>TRAFFIC LAB</em></div>
    <div className="workspace"><span className="workspace-mark"><Map size={15}/></span><span><b>Network study</b><small>Urban core · Scenario 01</small></span><ChevronDown size={15}/></div>
    <div className="section-cap">CONTROL ROOM</div><nav><a className="nav-active" href="#network"><Map size={16}/> Network map</a><a href="#scenario"><Settings2 size={16}/> Scenario setup</a><a href="#results"><BarChart3 size={16}/> Results & metrics</a></nav>
    <div className="side-lower"><div className="side-network"><div className="side-net-head"><span>NETWORK STATUS</span><i className={health ? 'green' : 'red'}/></div><div className="side-stat"><span>Road links</span><b>{12 + (settings.flyover ? 1 : 0)}</b></div><div className="side-stat"><span>Signal junctions</span><b>5</b></div><div className="side-stat"><span>Flyover</span><b>{settings.flyover ? 'OPEN' : 'CLOSED'}</b></div></div><div className="help"><CircleHelp size={15}/> Model guide <ArrowUpRight size={13}/></div><div className="profile"><div className="avatar">FS</div><div><b>Research workspace</b><small>Local simulation</small></div><ChevronDown size={14}/></div></div>
  </aside><main className="main">
    <header><div><div className="breadcrumb">TRAFFIC SYSTEMS <span>/</span> NETWORK CONTROL</div><h1>Urban traffic flow</h1><p>Configure the road network, inject demand, and inspect the resulting flow.</p></div><div className="head-right"><div className={`api-status ${health ? 'healthy' : ''}`}><i/>{health ? 'SIMULATION ONLINE' : 'API OFFLINE'}</div><span className="run-stamp">{result ? `RUN · SEED ${settings.seed}` : 'READY TO RUN'}</span></div></header>
    <div className="content"><section id="network" className="stage card"><div className="stage-top"><div><div className="eyebrow"><i className="blue-dot"/> LIVE NETWORK SIMULATION</div><h2>Central district <span className="subtle">/ 9 junctions · {12 + (settings.flyover ? 1 : 0)} links</span></h2></div><div className="stage-labels"><span><Layers3 size={13}/> Lane-aware roads</span><span className="signal-counts"><i className="signal-green"/>{signalCounts.green || 0} green<i className="signal-red"/>{signalCounts.red || 0} red</span>{result && <span className="clock-chip"><Clock3 size={13}/> {fmtTime(frame?.time_s || 0)} / {fmtTime(settings.duration_s)}</span>}</div></div>
      <div className="map-wrap"><NetworkMap frame={frame} result={result}/>{result && <div className="map-hud"><span className="live-tag"><i/> LIVE</span><span><b>{frame?.cars?.length || 0}</b> vehicles in network</span><span><b>{frame?.queue || 0}</b> queued</span><span><b>{signalCounts.red || 0}</b> red signals</span></div>}{!result && <div className="map-overlay"><div className="overlay-glyph"><GitBranch size={22}/></div><b>Network is ready</b><span>Waiting for the simulation API…</span></div>}</div>
      <div className="playback"><button className="play-btn" disabled={!result} onClick={() => { if (!playing && frameIndex >= totalFrames - 1) setFrameIndex(0); setPlaying(p => !p) }} aria-label={playing ? 'Pause playback' : 'Play playback'}>{playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><span className="timecode">{fmtTime(frame?.time_s || 0)}</span><input aria-label="Simulation playback timeline" className="timeline" type="range" min="0" max={Math.max(0, totalFrames - 1)} value={frameIndex} disabled={!result} onChange={e => { setPlaying(false); setFrameIndex(Number(e.target.value)) }} style={{ '--progress': `${totalFrames > 1 ? frameIndex / (totalFrames - 1) * 100 : 0}%` }}/><span className="time-end">{fmtTime(settings.duration_s)}</span><span className="frame-count">{frame?.cars?.length || 0} vehicles</span><button className="restart" title="Restart playback" disabled={!result} onClick={() => { setPlaying(true); setFrameIndex(0) }}><RotateCcw size={14}/></button></div>
    </section>
    <div className="lower"><section id="scenario" className="card scenario"><div className="card-title"><div><div className="eyebrow"><i className="orange-dot"/> SCENARIO BUILDER</div><h2>Demand & infrastructure</h2></div><button className="reset" onClick={() => applyPreset('City baseline')}><RotateCcw size={13}/> Reset</button></div>
      <div className="preset-row"><span>QUICK SCENARIOS</span>{Object.keys(presets).map(name => <button key={name} className="preset" onClick={() => applyPreset(name)}>{name}</button>)}</div>
      <div className="setting-group"><div className="setting-head"><label htmlFor="vehicles">Vehicle demand</label><b>{settings.vehicles}<small> agents</small></b></div><input id="vehicles" type="range" min="20" max="500" step="10" value={settings.vehicles} onChange={setNum('vehicles')}/><div className="range-captions"><span>Light flow</span><span>Heavy flow</span></div></div>
      <div className="two-settings"><label>Run duration<select value={settings.duration_s} onChange={setNum('duration_s')}><option value="120">2 minutes</option><option value="240">4 minutes</option><option value="360">6 minutes</option><option value="600">10 minutes</option></select></label><label>Signal cycle<select value={settings.signal_cycle_s} onChange={setNum('signal_cycle_s')}><option value="30">30 seconds</option><option value="45">45 seconds</option><option value="60">60 seconds</option><option value="90">90 seconds</option><option value="120">120 seconds</option></select></label></div>
      <div className="road-controls"><div className="control-title"><span>ROAD CAPACITY</span><span className="control-note">Lanes affect following & storage</span></div><label><span><i className="swatch arterial"/> Arterial roads</span><select value={settings.arterial_lanes} onChange={setNum('arterial_lanes')}><option value="1">1 lane</option><option value="2">2 lanes</option><option value="3">3 lanes</option><option value="4">4 lanes</option></select></label><label><span><i className="swatch local"/> Local roads</span><select value={settings.local_lanes} onChange={setNum('local_lanes')}><option value="1">1 lane</option><option value="2">2 lanes</option></select></label><label className="toggle-row"><span><i className="swatch flyover"/> Grade-separated flyover</span><button className={`toggle ${settings.flyover ? 'on' : ''}`} onClick={() => update('flyover', !settings.flyover)} aria-pressed={settings.flyover} aria-label="Toggle flyover"><i/></button></label></div>
      <div className="seed-row"><label htmlFor="seed">Random seed</label><input id="seed" type="number" min="0" max="100000" value={settings.seed} onChange={setNum('seed')}/><span>Same seed repeats the same arrivals and routes.</span></div>
      <button className="run-btn" onClick={run} disabled={busy || !health}><Play size={15} fill="currentColor"/>{busy ? 'Simulating vehicles…' : 'Run simulation'}<ArrowUpRight size={15}/></button>{error && <div className="error"><AlertCircle size={14}/>{error}</div>}<div className="model-note"><Radio size={13}/> Agent-based · lane-aware following · signalized junctions · 1-second steps</div>
    </section>
    <section id="results" className="results-col"><div className="metric-grid"><Metric icon={<Check size={14}/>} label="Completed trips" value={result ? `${result.metrics.completion_pct}%` : '—'} sub={result ? `${result.metrics.completed} of ${result.metrics.demand} agents` : 'Run a scenario'}/><Metric icon={<Clock3 size={14}/>} label="Avg. travel time" value={result && result.metrics.avg_trip_s != null ? `${Math.floor(result.metrics.avg_trip_s / 60)}m ${Math.round(result.metrics.avg_trip_s % 60)}s` : '—'} sub="Completed trips"/><Metric icon={<Gauge size={14}/>} label="Mean speed" value={result ? `${result.metrics.avg_speed_kmh} km/h` : '—'} sub="While vehicles are moving"/><Metric icon={<Truck size={14}/>} label="Peak queue" value={result ? `${result.metrics.max_queue} cars` : '—'} sub="Network-wide"/></div>
      <article className="card queue-card"><div className="chart-head"><div><div className="eyebrow"><i className="blue-dot"/> CONGESTION PROFILE</div><h2>Vehicles waiting over time</h2></div><span className="chart-unit">AGENTS</span></div>{result ? <div className="chart"><div className="chart-y"><span>{Math.max(1, ...queueSeries)}</span><span>{Math.round(Math.max(1, ...queueSeries) / 2)}</span><span>0</span></div><svg viewBox="0 0 100 46" preserveAspectRatio="none"><path d="M0 5H100M0 23H100M0 41H100" stroke="#e3e9ef" strokeDasharray="1 2" vectorEffect="non-scaling-stroke"/><polygon points={`0,41 ${queuePath} 100,41`} fill="url(#area)"/><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#528ce3" stopOpacity=".28"/><stop offset="1" stopColor="#528ce3" stopOpacity=".02"/></linearGradient></defs><polyline points={queuePath} fill="none" stroke="#528ce3" strokeWidth="1.7" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x"><span>00:00</span><span>{fmtTime(settings.duration_s / 2)}</span><span>{fmtTime(settings.duration_s)}</span></div></div> : <div className="chart-empty"><Activity size={17}/> Run a simulation to generate the queue profile.</div>}</article>
      <div className="emissions card"><div className="emission-icon"><Waves size={16}/></div><div><span>Estimated tailpipe emissions</span><b>{result ? `${result.metrics.estimated_co2_kg} kg CO₂` : '— kg CO₂'}</b></div><span className="emission-basis">distance proxy</span>{result && <button className="export-btn" onClick={exportCsv}><Download size={14}/> Export CSV</button>}</div>
      {result && <div className="capacity-note"><Activity size={14}/> Peak link use: <b>{result.metrics.peak_link_utilization}%</b><span>·</span> Vehicle distance: <b>{result.metrics.vehicle_km} km</b></div>}
    </section></div>
    <footer><span>FLOWSTATE <b>·</b> NETWORK CONTROL</span><span>Scenario exploration · Results are deterministic for a fixed seed.</span><span className="footer-seed"><span className="seed-dot"/> Seed {settings.seed}</span></footer></div>
  </main></div>
}

function Metric({ icon, label, value, sub }) { return <article className="card metric"><div className="metric-icon">{icon}</div><span className="metric-label">{label}</span><b className="metric-value">{value}</b><small>{sub}</small></article> }
export default App
