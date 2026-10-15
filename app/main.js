'use strict'
// Main process: options, the skin, the main window, its tabs, IPC
// wiring. Each tab's CLI child and its lifecycle are its Session's
// (app/session.js), the order of the tabs and the app's end are the
// Tabs' (app/tabs.js).

const { app, BrowserWindow, ipcMain, Menu, clipboard, dialog, protocol } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const cli = require('./cli')
const identity = require('./identity')
const runtime = require('./runtime')
const { Bus } = require('./metrics/bus')
const { open, watch, kindOf, carry } = require('./metrics/agent')
const { createRegistry } = require('./skins/registry')
const last = require('./skins/last')
const profiles = require('./profiles')
const { split } = require('./argv')
// SKINNED_SKINS_DIR points the skin list elsewhere, for checks over fixtures.
const skins = createRegistry({ shippedDir: process.env.SKINNED_SKINS_DIR || path.join(__dirname, '..', 'skins') })
const { Viz } = require('./viz')
const { View } = require('./view')
const { Session } = require('./session')
const { Tabs } = require('./tabs')
const background = require('./background')
const { Monitor } = require('./monitor')
const { Dashboard } = require('./dashboard')
const { Boards } = require('./board')
const sessions = require('./sessions')

// The tab strip's height in px, as app/renderer/app.css draws it.
const TAB_STRIP = 24

cli.adoptUserFd()

const opts = cli.parse(process.argv)
if (opts.error) {
  cli.tell(opts.error)
  process.exit(cli.EXIT_APP)
}
const resolved = cli.resolveCommand(opts.cmd[0], process.env.PATH)
if (!resolved) {
  cli.tell(`${opts.cmd[0]}: command not found`)
  process.exit(cli.EXIT_NOT_FOUND)
}

// The skin is chosen before any window opens or the CLI starts
// (decisions 0008, 0022). A given skin (--skin, SKINNED_SKIN) refuses
// loudly. A bare launch opens the last skin used, and asks once the app
// is ready when windows raced. Every launch and switch is recorded, a
// fallback to the default is not.
const lastDir = last.dir()
// This launch's problems, for the menu's Housekeeping.
const problems = []
let problemsSeen = 0
let raced = null

function refuse (errors) {
  for (const e of errors) cli.tell(e)
  process.exit(cli.EXIT_APP)
}

function remember () {
  try { last.record(lastDir, process.pid, skins.spec()) } catch (e) { log(`last skin: ${e.message}`) }
}

// A remembered skin that no longer loads gives way to the default.
function startRemembered (spec) {
  if (spec) {
    const r = skins.start(spec)
    if (!r.errors) return remember()
    problems.push({ title: `Remembered skin ${shown(spec)} refused, using the default`, detail: r.errors.join('\n') })
    log(`remembered skin ${spec} refused:\n${r.errors.join('\n')}`)
  }
  const r = skins.start(null)
  if (r.errors) refuse(r.errors)
}

function shown (spec) {
  const home = os.homedir()
  return spec.startsWith(home + path.sep) ? '~' + spec.slice(home.length) : spec
}

const records = last.read(lastDir)
try { last.prune(lastDir, records) } catch (e) { log(`last skin: ${e.message}`) }
if (opts.skin) {
  const r = skins.start(opts.skin)
  if (r.errors) refuse(r.errors)
  remember()
} else {
  const p = last.pick(records)
  if (p && p.choices) raced = p.choices
  else startRemembered(p && p.spec)
}

// corsEnabled: fonts are fetched in CORS mode, so FontFace needs it.
// stream: a skin's sounds play from it (decision 0024).
protocol.registerSchemesAsPrivileged([{ scheme: 'skin', privileges: { standard: true, secure: true, corsEnabled: true, stream: true } }])

if (process.env.SKINNED_GL === 'swiftshader') app.commandLine.appendSwitch('use-angle', 'swiftshader')

let runDir = null
try {
  runDir = runtime.create()
  app.setPath('userData', path.join(runDir, 'electron'))
  runtime.rotateLogs()
} catch (e) {
  cli.tell(`runtime dir: ${e.message}`)
  process.exit(cli.EXIT_APP)
}

let win = null
const view = new View()
let viz = null

function log (msg) {
  process.stderr.write(`[${new Date().toISOString()}] ${msg}\n`)
}

// A problem for Housekeeping. A problem not yet seen puts the dot on the
// menu button (decision 0022).
function problem (title, detail) {
  problems.push({ title, detail })
  view.send('house', { unseen: problems.length - problemsSeen })
}

// The view of one tab, as its Session sees app/view.js: its bytes carry
// its id, and its strip shows while it is the active tab. The page load
// is the window's, which sends the active tab's strip.
function tabView (tab) {
  return {
    send (channel, payload) {
      if (channel === 'pty:data') {
        if (tab !== tabs.active && !tab.unseen) {
          tab.unseen = true
          sendTabs()
        }
        return view.send('pty:data', tab.id, payload)
      }
      if (channel === 'strip' && tab === tabs.active) view.send('strip', payload)
    },
    onLoad () {}
  }
}

// A tab runs cmd, resolved to file, in cwd with env, the window's
// environment unless New tab... set a profile (decision 0025), its agent
// adapter beside Generic (decision 0021), its bus, and its own directory
// under the runtime dir for the adapter's generated files (decision 0016).
function makeTab (id, { cmd, cwd, env = process.env, file = resolved, note = null, monitor = null, dashboard = false }) {
  if (monitor) return makeMonitor(id, monitor)
  if (dashboard) return makeDashboard(id)
  const dir = path.join(runDir, `tab-${id}`)
  fs.mkdirSync(dir, { mode: 0o700 })
  const bus = new Bus({ log })
  const agent = open({ cmd, cwd, env, runDir: dir, root: runtime.base(), store: runtime.settingsDir(), options: opts, bus, log })
  const tab = { id, cmd, cwd, env, file, dir, bus, agent, label: identity.label(cmd, env, kindOf(cmd)) }
  tab.session = new Session({ file, argv: cmd, cwd, env, label: tab.label, note, adapters: [agent], view: tabView(tab), tell: cli.tell, log, execError: path.join(dir, 'exec-error'), screen: () => screenOf(tab) })
  return tab
}

// The last screen of a tab's terminal as text, or null (decision 0030).
// The ask follows the tab's bytes on one channel, so the renderer draws
// them first.
let screenAsks = 0
const screenWaits = new Map()
function screenOf (tab) {
  if (view.gone()) return Promise.resolve(null)
  const n = ++screenAsks
  return new Promise(resolve => {
    screenWaits.set(n, resolve)
    view.send('screen:ask', tab.id, n)
  }).finally(() => screenWaits.delete(n))
}
ipcMain.on('screen:text', (_e, n, text) => {
  const resolve = screenWaits.get(n)
  if (resolve) resolve(typeof text === 'string' ? text : null)
})

// A Claude tab whose CLI refused to open a background session the user
// picked opens it with `claude attach ID` in its place (decision 0030).
function follow (tab) {
  if (readOnly(tab) || kindOf(tab.cmd) !== 'claude') return null
  const cmd = background.attachFor(tab.cmd, tab.session.lastScreen)
  if (!cmd) return null
  log(`tab ${tab.id}: claude refused to open a background session in place, opening it with: ${cmd.join(' ')}`)
  return { cmd, cwd: tab.cwd, env: tab.env, file: tab.file }
}

const tabs = new Tabs({ make: (id, spec) => makeTab(id, spec), tell: cli.tell, log, follow })

// A tab with no CLI of the app's: a monitor (decision 0027) or the
// sessions dashboard (decision 0028).
const readOnly = t => !!(t.monitor || t.dashboard)

// The first tab runs the command as typed (decision 0003).
try {
  tabs.add({ cmd: opts.cmd, cwd: process.cwd() })
} catch (e) {
  cli.tell(`cannot open the tab: ${e.message}`)
  process.exit(cli.EXIT_APP)
}

// The live folder of a tab's CLI, else the folder it started in.
function liveCwd (tab) {
  try {
    const d = fs.readlinkSync(`/proc/${tab.session.pid}/cwd`)
    if (fs.statSync(d).isDirectory()) return d
  } catch (e) {}
  return tab.cwd
}

// What a new tab did not carry, for its strip, cut to fit.
function droppedNote (dropped) {
  if (!dropped.length) return null
  const s = dropped.map(identity.quote).join(' ')
  return 'not carried: ' + (s.length > 60 ? s.slice(0, 57) + '...' : s)
}

// New tab (decision 0023): the window's command with the options its
// provider carries, never those of one session, in the active tab's
// folder.
function newTab () {
  const from = tabs.active
  const { args, dropped } = carry(opts.cmd)
  try {
    tabs.add({ cmd: [opts.cmd[0], ...args], cwd: from ? liveCwd(from) : process.cwd(), note: droppedNote(dropped) })
  } catch (e) {
    log(`new tab: ${e.stack || e}`)
    problem('New tab failed', e.message)
  }
}

// The profiles a session the app did not start may run on (decision
// 0027): the default, the window's, the open tabs', those recorded.
function knownProfiles (kind) {
  const open = tabs.list.filter(t => !readOnly(t) && kindOf(t.cmd) === kind).map(t => profiles.of(t.env, kind))
  const recorded = profiles.read(profilesDir).filter(r => r.agent === kind).map(r => r.dir)
  return [...new Set([profiles.defaultDir(kind), profiles.of(process.env, kind), ...open, ...recorded])]
}

// A session's transcript or rollout among the known profiles, or null.
function channelOf (s) {
  return s.kind === 'claude' ? sessions.claudeTranscript(s, knownProfiles('claude')) : sessions.codexRollout(s, knownProfiles('codex'))
}

// The label of a session the app did not start: its profile's name, ?
// when the profile cannot be told (decision 0027).
function foreignLabel (kind, found) {
  if (!found || !found.profile) return `${kind} [?]`
  return identity.label([kind], { [profiles.AGENTS[kind].variable]: found.profile }, kind)
}

// The watch agent of a session the app did not start, w a scan entry
// with its channel found, on bus (decisions 0027, 0028).
function watchAgent (w, bus) {
  const env = w.kind === 'codex' ? { CODEX_HOME: (w.found && w.found.home) || profiles.defaultDir('codex') } : {}
  return watch({ kind: w.kind, argv: w.argv, cwd: w.cwd, started: w.started, env, find: () => sessions.claudeTranscript(w, knownProfiles('claude')), bus, log })
}

// A read-only tab of a session the app did not start (decision 0027).
function makeMonitor (id, w) {
  const bus = new Bus({ log })
  const agent = watchAgent(w, bus)
  const label = foreignLabel(w.kind, w.found)
  const tab = { id, cmd: w.argv, cwd: w.cwd, env: {}, file: null, dir: null, bus, agent, label, monitor: { pid: w.pid, started: w.started } }
  tab.session = new Monitor({ watched: w, label, adapters: [agent], view: tabView(tab), log })
  return tab
}

const keyOf = s => `${s.pid}:${Math.round(s.started)}`
const watching = s => tabs.list.find(t => t.monitor && t.monitor.pid === s.pid && sessions.same(s.pid, t.monitor.started)) || null

// The menu's agent sessions (decision 0027): every live session of this
// user, this window's tabs first, each { s, tab, row }: its scan entry,
// the tab that shows it or null, and the menu's row. A session in a tab,
// its own or one it watches, is that tab's. A session started inside a
// tab's session is left out.
function listSessions () {
  const now = Date.now()
  const all = sessions.scan()
  const listed = new Set(all.map(s => s.pid))
  const byPid = new Map(tabs.list.filter(t => t.session.pid).map(t => [t.session.pid, t]))
  const out = []
  for (const s of all) {
    let tab = byPid.get(s.pid) || null
    if (!tab) {
      const up = sessions.ancestors(s.pid).find(p => byPid.has(p))
      if (up && listed.has(up)) continue
      if (up) tab = byPid.get(up)
    }
    const row = { key: keyOf(s), folder: identity.tildify(s.cwd), age: now - s.started }
    if (tab) {
      const busy = tab.bus.get('state.busy')
      out.push({ s, tab, row: Object.assign(row, { tab: tab.id, where: 'tab', label: tab.label, state: busy === 1 ? 'working' : busy === 0 ? 'waiting' : 'unknown' }) })
      continue
    }
    const found = channelOf(s)
    const w = watching(s)
    out.push({ s: Object.assign({}, s, { found }), tab: w, row: Object.assign(row, { tab: w ? w.id : null, where: w ? 'monitor' : '', label: foreignLabel(s.kind, found), state: sessions.stateOf(found && found.mtime, now) }) })
  }
  return out.sort((a, b) => (a.tab === null) - (b.tab === null))
}

const liveSessions = () => listSessions().map(e => e.row)

// The sessions dashboard (decision 0028): one tab per window, with no
// CLI. A session elsewhere gets a headless watch agent on a bus of its
// own while the dashboard shows it.
// The newest dashboard tab, kept for the probe after it closes.
let lastDashboard = null
// The issue boards of the sessions' projects (decision 0029), per window,
// so a dashboard opened again within 5 minutes reads no board again.
const boards = new Boards({ log })

function makeDashboard (id) {
  const bus = new Bus({ log })
  const agent = { report: () => ({ agent: 'dashboard', session: null, channels: [], notice: null }), close () {} }
  const tab = { id, cmd: ['sessions'], cwd: process.cwd(), env: {}, file: null, dir: null, bus, agent, label: 'sessions', dashboard: true }
  tab.session = new Dashboard({
    list: listSessions,
    watcher: s => { const b = new Bus({ log }); return { agent: watchAgent(s, b), bus: b } },
    send: d => view.send('dashboard', tab.id, d),
    view: tabView(tab),
    board: folder => boards.get(folder),
    log
  })
  lastDashboard = tab
  return tab
}

function openDashboard () {
  const d = tabs.list.find(t => t.dashboard)
  if (d) return tabs.activate(d.id)
  try {
    tabs.add({ dashboard: true })
  } catch (e) {
    log(`dashboard: ${e.stack || e}`)
    problem('Sessions dashboard failed', e.message)
  }
}

// A session of the list: its tab made active, else a monitor tab opened.
function openSession (key) {
  const s = sessions.scan().find(x => keyOf(x) === key)
  if (!s) return { error: 'That session has ended.' }
  const own = tabs.list.find(t => t.session.pid === s.pid || (t.session.pid && sessions.ancestors(s.pid).includes(t.session.pid))) || watching(s)
  if (own) {
    tabs.activate(own.id)
    return { ok: true }
  }
  try {
    tabs.add({ monitor: Object.assign({}, s, { found: channelOf(s) }) })
  } catch (e) {
    log(`monitor: ${e.stack || e}`)
    return { error: `cannot watch it: ${e.message}` }
  }
  return { ok: true }
}

// The command that resumes a tab's session, or with fork copies it
// (decision 0026): the options New tab carries, never those of one
// session, and the session's id. Without an id, a new session of the
// same command.
function sessionCmd (cmd, session, fork) {
  const { args } = carry(cmd)
  const kind = kindOf(cmd)
  if (session && kind === 'claude') return [cmd[0], ...args, '--resume', session, ...(fork ? ['--fork-session'] : [])]
  if (session && kind === 'codex') return [cmd[0], fork ? 'fork' : 'resume', ...args, session]
  return [cmd[0], ...args]
}

// The window's closed tabs, newest last, each made once its CLI is
// reaped, so no reopened session ever has two writers (decision 0026).
const closed = []

const sessionOf = tab => tab.agent.report().session

// Reopen closed tab: in its agent, profile and folder. A session another
// tab now runs is that tab's alone: it is made active instead.
function reopen () {
  const e = closed.pop()
  if (!e) return
  const live = e.session && tabs.list.find(t => sessionOf(t) === e.session)
  if (live) return tabs.activate(live.id)
  try {
    tabs.add({ cmd: sessionCmd(e.cmd, e.session, false), cwd: e.cwd, env: e.env, file: e.file })
  } catch (err) {
    closed.push(e)
    log(`reopen: ${err.stack || err}`)
    problem('Reopen closed tab failed', err.message)
  }
}

// Duplicate tab: a fork of the active tab's session, beside it. The
// original keeps its session alone.
function duplicate () {
  const from = tabs.active
  if (!from) return
  const at = tabs.list.indexOf(from) + 1
  try {
    const t = tabs.add({ cmd: sessionCmd(from.cmd, sessionOf(from), true), cwd: from.cwd, env: from.env, file: from.file })
    if (t) tabs.move(t.id, at)
  } catch (err) {
    log(`duplicate: ${err.stack || err}`)
    problem('Duplicate tab failed', err.message)
  }
}

// What the menu's Reopen and Duplicate entries say.
function tabsMenu () {
  const e = closed[closed.length - 1]
  const a = tabs.active && !readOnly(tabs.active) ? tabs.active : null
  return { reopen: e ? { fresh: !e.session } : null, duplicate: a ? { fresh: !sessionOf(a) } : null }
}

// New tab... (decision 0025): per agent its profiles and the command
// line it would run, the window's command with the options it carries
// when the window runs that agent, else the bare CLI. The agent and the
// folder of the active tab come first.
const profilesDir = profiles.dir()

function chooserState () {
  const from = tabs.active && !readOnly(tabs.active) ? tabs.active : null
  const windowKind = kindOf(opts.cmd)
  const records = profiles.read(profilesDir)
  const agents = Object.entries(profiles.AGENTS).map(([kind, a]) => {
    const own = kind === windowKind
    const c = own ? carry(opts.cmd) : { args: [], dropped: [] }
    const open = tabs.list.filter(t => !readOnly(t) && kindOf(t.cmd) === kind).map(t => profiles.of(t.env, kind))
    return {
      kind,
      name: a.name,
      variable: a.variable,
      line: [own ? opts.cmd[0] : a.cmd, ...c.args].map(identity.quote).join(' '),
      dropped: c.dropped.map(identity.quote).join(' '),
      profiles: profiles.list(kind, records, open).map(p => Object.assign(p, { shown: identity.tildify(p.dir) })),
      profile: from && kindOf(from.cmd) === kind ? profiles.of(from.env, kind) : profiles.defaultDir(kind)
    }
  })
  const fromKind = from && kindOf(from.cmd)
  const at = tabs.active
  return { agents, agent: profiles.AGENTS[fromKind] ? fromKind : 'claude', folder: identity.tildify(at ? liveCwd(at) : process.cwd()) }
}

// A folder as typed: ~ is the home directory, a relative one is the
// active tab's folder's.
function folderOf (typed) {
  const home = os.homedir()
  const t = String(typed || '').trim()
  const p = t === '~' ? home : t.startsWith('~/') ? path.join(home, t.slice(2)) : t
  return path.resolve(tabs.active ? liveCwd(tabs.active) : process.cwd(), p)
}

const isDir = p => { try { return fs.statSync(p).isDirectory() } catch (e) { return false } }

// Open what the chooser holds, or say why not. The profile is recorded
// once a tab runs on it.
function chooserOpen ({ agent, profile, folder, line }) {
  if (!profiles.AGENTS[agent]) return { error: `no agent ${agent}` }
  const cwd = folderOf(folder)
  if (!isDir(cwd)) return { error: `no such folder: ${identity.tildify(cwd)}` }
  if (typeof profile !== 'string' || !path.isAbsolute(profile)) return { error: 'choose a profile' }
  const dflt = profile === profiles.defaultDir(agent)
  if (!dflt && !isDir(profile)) return { error: `no such profile folder: ${identity.tildify(profile)}` }
  const r = split(line)
  if (r.error) return { error: `command line: ${r.error}` }
  const env = profiles.envFor(process.env, agent, profile)
  const c = r.argv[0]
  const file = cli.resolveCommand(c.includes('/') ? path.resolve(cwd, c) : c, env.PATH)
  if (!file) return { error: `${c}: command not found` }
  try {
    tabs.add({ cmd: r.argv, cwd, env, file })
  } catch (e) {
    log(`new tab: ${e.stack || e}`)
    return { error: `cannot open the tab: ${e.message}` }
  }
  if (!dflt) try { profiles.record(profilesDir, agent, profile) } catch (e) { log(`profiles: ${e.message}`) }
  return { ok: true }
}

// The renderer's view of the tabs. Tabs of one label add their folder's
// name (decision 0004).
function tabState () {
  const n = new Map()
  for (const t of tabs.list) n.set(t.label, (n.get(t.label) || 0) + 1)
  return {
    active: tabs.active ? tabs.active.id : null,
    tabs: tabs.list.map(t => ({
      id: t.id,
      label: t.label,
      folder: n.get(t.label) > 1 ? path.basename(t.cwd) || t.cwd : null,
      busy: t.bus.get('state.busy') === 1,
      unseen: t.unseen,
      kind: t.dashboard ? 'dashboard' : 'term'
    }))
  }
}

let sentTabs = ''
function sendTabs () {
  const s = tabState()
  const key = JSON.stringify(s)
  if (key === sentTabs) return
  sentTabs = key
  view.send('tabs', s)
}

// The minimum size grows by the tab strip while it shows, so the skin
// area is never smaller than the validator checked (decisions 0006,
// 0022, 0023).
function fitWindow () {
  const skin = skins.current()
  if (!skin) return
  const h = skin.window.minHeight + (tabs.list.length > 1 ? TAB_STRIP : 0)
  view.setMinimumSize(skin.window.minWidth, h)
  view.growTo(skin.window.minWidth, h)
}

// The strip, the title, the meters and the viz follow the active tab.
tabs.on('active', tab => {
  tab.session.sendStrip()
  view.setTitle(identity.title(tab.label))
  view.send('metrics', tab.bus.snapshot())
  if (viz) viz.follow(tab.bus, 'visualization: ' + identity.title(tab.label))
})
tabs.on('change', () => {
  sendTabs()
  fitWindow()
})
// A CLI that exits on its own with a status other than 0 is a problem,
// unless it was the last tab and the app ends with it.
tabs.on('gone', (tab, code, next) => {
  try { runtime.remove(tab.dir) } catch (e) { log(`tab dir: ${e.message}`) }
  if (next) return
  if (!tabs.ending && !readOnly(tab)) closed.push({ cmd: tab.cmd, cwd: tab.cwd, env: tab.env, file: tab.file, session: sessionOf(tab) })
  if (!tab.closed && code !== 0 && tabs.list.length) {
    const why = tab.session.failure ? `cannot start ${tab.cmd[0]}: ${tab.session.failure}\n` : ''
    problem(`${tab.label} exited with status ${code}`, `${why}${tab.session.cmdline}\nin ${identity.tildify(tab.cwd)}`)
  }
})

// The app exits only once the last child is reaped: Electron cannot exit
// while a node-pty child lives.
tabs.ended.then(code => {
  try { runtime.remove(runDir) } catch (e) { log(`runtime dir: ${e.message}`) }
  echoLastScreen()
  app.exit(code)
})

// A window that ends because its last CLI exited by itself leaves that
// CLI's last screen in the terminal it was started from, as the CLI
// would have left it there without the app (decision 0030).
function echoLastScreen () {
  const t = tabs.last
  if (!t || t.closed || tabs.status !== null || !t.session.lastScreen || !process.stdout.isTTY) return
  try { fs.writeSync(1, t.session.lastScreen + '\n') } catch (e) { log(`last screen: ${e.message}`) }
}

process.on('uncaughtException', e => tabs.fail(e))
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => tabs.hangupAll())

// The one probe the live checks read (decisions 0019, 0021, 0023): the
// active tab's child, report and bus, and every tab.
global.skinnedProbe = () => {
  const a = tabs.active
  return {
    childPid: a ? a.session.pid : null,
    following: a ? a.agent.report() : null,
    snapshot: a ? a.bus.snapshot() : {},
    lastDashboard: lastDashboard ? lastDashboard.session.report() : null,
    boards: boards.report(),
    tabs: tabs.list.map(t => ({ id: t.id, childPid: t.session.pid, monitor: t.monitor ? t.monitor.pid : null, dashboard: t.dashboard ? t.session.report() : null, label: t.label, cwd: t.cwd, argv: t.cmd, active: t === a, following: t.agent.report(), snapshot: t.bus.snapshot() }))
  }
}

const tabOf = id => tabs.get(id)
ipcMain.handle('tabs:get', () => tabState())
ipcMain.on('pty:ready', (_e, id, cols, rows) => { const t = tabOf(id); if (t) t.session.start(cols, rows) })
ipcMain.on('pty:input', (_e, id, d) => { const t = tabOf(id); if (t) t.session.input(d) })
ipcMain.on('pty:resize', (_e, id, cols, rows) => { const t = tabOf(id); if (t) t.session.resize(cols, rows) })
ipcMain.on('tab:new', () => newTab())
ipcMain.on('tab:close', (_e, id) => tabs.close(id === null ? tabs.active && tabs.active.id : id))
ipcMain.on('tab:activate', (_e, id) => tabs.activate(id))
ipcMain.on('tab:step', (_e, d) => tabs.step(d === -1 ? -1 : 1))
ipcMain.on('tab:move', (_e, id, index) => tabs.move(id, index))
ipcMain.handle('tabs:menu', () => tabsMenu())
ipcMain.handle('sessions:list', () => liveSessions())
ipcMain.handle('sessions:open', (_e, key) => openSession(String(key)))
ipcMain.on('dashboard:open', () => openDashboard())
ipcMain.on('tab:reopen', () => reopen())
ipcMain.on('tab:duplicate', () => duplicate())
ipcMain.handle('chooser:get', () => chooserState())
ipcMain.handle('chooser:open', (_e, pick) => chooserOpen(pick || {}))
ipcMain.handle('chooser:forget', (_e, agent, dir) => {
  if (profiles.AGENTS[agent] && typeof dir === 'string') try { profiles.forget(profilesDir, agent, dir) } catch (e) { log(`profiles: ${e.message}`) }
  return chooserState()
})
// Other profile...: config dirs are hidden folders.
ipcMain.handle('chooser:profile', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Other profile', defaultPath: os.homedir(), properties: ['openDirectory', 'showHiddenFiles'] })
  return r.canceled || !r.filePaths.length ? { canceled: true } : { dir: r.filePaths[0], shown: identity.tildify(r.filePaths[0]) }
})
ipcMain.handle('chooser:folder', async (_e, typed) => {
  const at = folderOf(typed)
  const r = await dialog.showOpenDialog(win, { title: 'Folder', defaultPath: isDir(at) ? at : os.homedir(), properties: ['openDirectory'] })
  return r.canceled || !r.filePaths.length ? { canceled: true } : { dir: identity.tildify(r.filePaths[0]) }
})
ipcMain.on('clip:write', (_e, { text, type }) => clipboard.writeText(text, type === 'selection' ? 'selection' : 'clipboard'))
ipcMain.handle('clip:read', () => clipboard.readText('clipboard'))
ipcMain.on('open-link', (_e, url) => {
  let u
  try { u = new URL(url) } catch (e) { return }
  if (!['http:', 'https:', 'file:'].includes(u.protocol)) return
  const p = spawn('xdg-open', [u.href], { detached: true, stdio: 'ignore' })
  p.on('error', () => {})
  p.unref()
})

function sendSkin () {
  const skin = skins.current()
  if (!skin) return
  fitWindow()
  view.send('skin:load', skin)
}

// A skin chosen in the menu: shown and recorded, or refused with the
// current skin kept (decision 0008).
function applied (what, r) {
  if (r.errors) {
    log(`skin ${what} refused:\n${r.errors.join('\n')}`)
    return { error: r.errors.join('\n') }
  }
  sendSkin()
  remember()
  return { ok: true }
}

ipcMain.handle('skins:list', () => skins.list().map(s => Object.assign({}, s, { location: s.location && identity.tildify(s.location) })))
ipcMain.handle('viz:state', () => ({ open: !!(viz && viz.isOpen()), modes: viz ? viz.modes() : [] }))
ipcMain.on('viz:toggle', () => { if (viz) viz.toggle() })
ipcMain.handle('viz:select', (_e, id) => viz && viz.select(id) ? { ok: true } : { error: `no visualization mode ${id}` })
// Skin sounds (decision 0024): muted for the window, from --mute or
// SKINNED_MUTE=1 at launch, toggled in the menu.
let muted = opts.mute
ipcMain.handle('sound:state', () => muted)
ipcMain.on('sound:toggle', () => {
  muted = !muted
  view.send('sound:muted', muted)
})
ipcMain.handle('skin:select', (_e, id) => applied(id, skins.select(id)))
ipcMain.handle('skin:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Open skin', properties: ['openDirectory'] })
  if (r.canceled || !r.filePaths.length) return { canceled: true }
  return applied(r.filePaths[0], skins.open(r.filePaths[0]))
})

// Housekeeping (decision 0022).
ipcMain.handle('house:get', () => ({ problems, unseen: problems.length - problemsSeen }))
ipcMain.on('house:seen', () => { problemsSeen = problems.length })
ipcMain.handle('house:forget', () => {
  try { last.forget(lastDir) } catch (e) { return { error: `forget: ${e.message}` } }
  return { note: 'Forgotten. The next launch opens the default skin, unless a window records another.' }
})
ipcMain.on('house:logs', () => {
  const dir = runtime.logDir()
  try { fs.mkdirSync(dir, { recursive: true }) } catch (e) {}
  const p = spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' })
  p.on('error', e => log(`open log folder: ${e.message}`))
  p.unref()
})
ipcMain.handle('house:clear', () => {
  try {
    const n = runtime.clearLogs()
    return { note: `Removed ${n} log${n === 1 ? '' : 's'} of ended windows.` }
  } catch (e) {
    return { error: `clear logs: ${e.message}` }
  }
})

Menu.setApplicationMenu(null)

app.whenReady().then(async () => {
  if (raced) {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      title: 'claude-skins',
      message: 'Windows chose different skins at nearly the same time.',
      detail: 'Which skin should this window open?',
      buttons: raced.map(shown),
      defaultId: 0,
      cancelId: 0
    })
    try { last.forget(lastDir) } catch (e) { log(`last skin: ${e.message}`) }
    startRemembered(raced[response])
  }
  protocol.handle('skin', skins.handle)
  const skin = skins.current()
  const sw = skin ? skin.window : { width: 1100, height: 760, minWidth: 600, minHeight: 400 }
  const first = tabs.active
  win = new BrowserWindow({
    width: sw.width,
    height: sw.height,
    minWidth: sw.minWidth,
    minHeight: sw.minHeight,
    useContentSize: true,
    title: identity.title(first.label),
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false
    }
  })
  win.on('page-title-updated', e => e.preventDefault())
  // app.exit closes the window with no close event, so every close seen
  // here is the user's. Several live tabs ask first (decision 0023).
  let asking = false
  win.on('close', e => {
    e.preventDefault()
    if (asking || tabs.ending) return
    if (tabs.list.length < 2) return closeWindow()
    asking = true
    dialog.showMessageBox(win, {
      type: 'question',
      title: 'claude-skins',
      message: `Close ${tabs.list.length} tabs?`,
      detail: 'Each tab\'s CLI is hung up.',
      buttons: ['Close tabs', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      asking = false
      if (response === 0) closeWindow()
    }, err => {
      asking = false
      tabs.fail(err)
    })
  })
  win.webContents.on('will-navigate', e => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  view.attach(win)
  view.onLoad(() => {
    sentTabs = ''
    sendTabs()
    if (tabs.active) tabs.active.session.sendStrip()
  })
  view.onLoad(sendSkin)
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  setInterval(() => {
    if (tabs.active) view.send('metrics', tabs.active.bus.snapshot())
    sendTabs()
  }, 100).unref()
  viz = new Viz(first.bus, 'visualization: ' + identity.title(first.label), view, log)
  if (opts.viz) view.whenLoaded(() => viz.open())
})

// The Session of each tab ends its child, then the app ends.
function closeWindow () {
  if (viz) viz.close()
  tabs.hangupAll()
}

// Closing the main window ends every tab. The viz closes alone.
app.on('window-all-closed', () => tabs.hangupAll())

// A quit the app did not ask for, such as a signal Chromium handles while
// the launch dialog waits with no window, ends every tab instead.
// app.exit, the only way the app leaves, emits no before-quit.
app.on('before-quit', e => {
  e.preventDefault()
  tabs.hangupAll()
})
