import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createService, type Ui } from '../src/main/service'
import { Store, type TokenCrypto } from '../src/main/store'
import {
  defaultShell,
  shellEnv,
  TerminalManager,
  type PtyOptions,
  type PtyProcess,
  type SpawnPty
} from '../src/main/terminal'
import { terminalColors, TERMINAL_TOKENS } from '../src/renderer/src/lib/terminalTheme'
import { emptyRepo, tempDir } from './helpers'

class FakePty implements PtyProcess {
  written: string[] = []
  size: [number, number] | null = null
  killed = false
  private dataCb: (d: string) => void = () => {}
  private exitCb: (e: { exitCode: number }) => void = () => {}
  onData(cb: (d: string) => void): void {
    this.dataCb = cb
  }
  onExit(cb: (e: { exitCode: number }) => void): void {
    this.exitCb = cb
  }
  write(d: string): void {
    this.written.push(d)
  }
  resize(c: number, r: number): void {
    this.size = [c, r]
  }
  kill(): void {
    this.killed = true
  }
  emit(d: string): void {
    this.dataCb(d)
  }
  end(code: number): void {
    this.exitCb({ exitCode: code })
  }
}

function fake() {
  const ptys: FakePty[] = []
  const calls: { shell: string; args: string[]; options: PtyOptions }[] = []
  const spawn: SpawnPty = async (shell, args, options) => {
    calls.push({ shell, args, options })
    const p = new FakePty()
    ptys.push(p)
    return p
  }
  const data: [string, string][] = []
  const exits: [string, number][] = []
  const manager = new TerminalManager(
    { data: (id, d) => data.push([id, d]), exit: (id, c) => exits.push([id, c]) },
    spawn
  )
  return { manager, ptys, calls, data, exits }
}

test('a session starts in the folder, passes input and output, and reports its exit', async () => {
  const f = fake()
  const dir = tempDir()
  const id = await f.manager.create(dir, 80, 24)
  assert.equal(f.calls[0].options.cwd, dir)
  assert.equal(f.calls[0].options.env['TERM'], 'xterm-256color')
  f.manager.write(id, 'ls\r')
  assert.deepEqual(f.ptys[0].written, ['ls\r'])
  f.ptys[0].emit('hello')
  assert.deepEqual(f.data, [[id, 'hello']])
  f.manager.resize(id, 100, 30)
  assert.deepEqual(f.ptys[0].size, [100, 30])
  f.ptys[0].end(3)
  assert.deepEqual(f.exits, [[id, 3]])
  assert.throws(() => f.manager.write(id, 'x'), /not running/)
})

test('sessions are independent and killAll ends every one', async () => {
  const f = fake()
  const a = await f.manager.create(tempDir(), 80, 24)
  const b = await f.manager.create(tempDir(), 80, 24)
  assert.notEqual(a, b)
  f.manager.kill(a)
  assert.equal(f.ptys[0].killed, true)
  assert.equal(f.ptys[1].killed, false)
  f.manager.kill(a) // already gone: no error
  f.manager.killAll()
  assert.equal(f.ptys[1].killed, true)
})

test('bad sizes, input and folders are refused', async () => {
  const f = fake()
  const dir = tempDir()
  await assert.rejects(f.manager.create(dir, 0, 24), /Invalid terminal width/)
  await assert.rejects(f.manager.create(dir, 80, 1.5), /Invalid terminal height/)
  await assert.rejects(f.manager.create(dir, '80', 24), /Invalid terminal width/)
  await assert.rejects(f.manager.create(`${dir}/missing`, 80, 24), /no longer exists/)
  const id = await f.manager.create(dir, 80, 24)
  assert.throws(() => f.manager.write(id, 5), /Invalid input/)
  assert.throws(() => f.manager.write(id, 'x'.repeat(1_000_001)), /Invalid input/)
  assert.throws(() => f.manager.resize(id, 5000, 24), /Invalid terminal width/)
  assert.throws(() => f.manager.write('nope', 'x'), /not running/)
})

test('a failing spawn becomes a plain error', async () => {
  const manager = new TerminalManager({ data: () => {}, exit: () => {} }, async () => {
    throw new Error('posix_spawnp failed.')
  })
  await assert.rejects(manager.create(tempDir(), 80, 24), /Could not start the shell: posix_spawnp/)
})

test('shell and environment defaults', () => {
  assert.equal(defaultShell('win32', { COMSPEC: 'cmd.exe' }).shell, 'cmd.exe')
  assert.equal(defaultShell('darwin', { SHELL: '/bin/sh' }).shell, '/bin/sh')
  assert.equal(defaultShell('darwin', { SHELL: '/no/such/shell' }).shell, '/bin/zsh')
  const env = shellEnv({ PATH: '/bin', ELECTRON_RUN_AS_NODE: '1', GONE: undefined })
  assert.equal(env['PATH'], '/bin')
  assert.equal(env['TERM'], 'xterm-256color')
  assert.equal('ELECTRON_RUN_AS_NODE' in env, false)
  assert.equal('GONE' in env, false)
})

test('terminal colours come only from tokens', () => {
  const asked: string[] = []
  const colors = terminalColors((token) => {
    asked.push(token)
    return token === '--lane-3' ? '' : ` ${token} `
  })
  assert.equal(colors.background, '--island')
  assert.equal(colors.magenta, '--text', 'an unreadable token falls back to the text colour')
  assert.ok(asked.every((t) => t.startsWith('--')))
  assert.equal(Object.keys(colors).length, Object.keys(TERMINAL_TOKENS).length)
})

const crypto: TokenCrypto = {
  isAvailable: () => true,
  encrypt: (s) => Buffer.from(s),
  decrypt: (b) => b.toString()
}

test('the service starts a shell only in a linked folder and forwards its events', async () => {
  const dir = emptyRepo()
  const store = new Store(tempDir(), crypto)
  await store.load()
  await store.setLink('local:1', dir)
  const ui: Ui = {
    pickFolder: async () => null,
    confirm: async () => false,
    reveal: () => {},
    openExternal: async () => {}
  }
  const f = fake()
  const seen: string[] = []
  const { api, shutdown } = createService({
    store,
    ui,
    emitProgress: () => {},
    emitRepoChanged: () => {},
    emitTerminalData: (id, d) => seen.push(`${id}:${d}`),
    emitTerminalExit: () => {},
    spawnPty: async (shell, args, options) => {
      f.calls.push({ shell, args, options })
      const p = new FakePty()
      f.ptys.push(p)
      return p
    }
  })
  await assert.rejects(api.terminal.create(emptyRepo(), 80, 24), /not linked/)
  assert.equal(f.calls.length, 0)
  const id = await api.terminal.create(dir, 80, 24)
  f.ptys[0].emit('x')
  assert.deepEqual(seen, [`${id}:x`])
  await api.terminal.write(id, 'pwd\r')
  assert.deepEqual(f.ptys[0].written, ['pwd\r'])
  shutdown()
  assert.equal(f.ptys[0].killed, true)
})
