#!/usr/bin/env node
/**
 * pi 全局能力层 → macmini 实时同步 watcher
 *
 * 监听 ~/.pi/agent/ 下「能力层」的变化（CLAUDE.md / skills / docs / patch /
 * extensions / settings.json / models.json / mcp-adapter.json / auth.json），
 * 防抖 8 秒后执行 sync-to-macmini.sh——即「内容变了就同步」的实时机制
 * （非定时）。由 launchd（com.xhq.pi-sync-macmini，RunAtLoad + KeepAlive）
 * 常驻运行；日志 ~/Library/Logs/pi-sync-macmini.log。
 *
 * 不触发（高写入/运行时目录）：sessions / state / intercom / tmp / bin /
 * npm / models-store.json / mcp-*-cache* / trust.json / .lock.d / node_modules
 * 2026-10-17 由 Kit 会话建立。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { watch } = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(os.homedir(), '.pi', 'agent');
const SYNC = path.join(ROOT, 'patch', 'sync-to-macmini', 'sync-to-macmini.sh');
const LOG = path.join(os.homedir(), 'Library', 'Logs', 'pi-sync-macmini.log');
const DEBOUNCE_MS = 8000;

const INCLUDE = [
  'CLAUDE.md',
  'skills',
  'docs',
  'patch',
  'extensions',
  'settings.json',
  'models.json',
  'mcp-adapter.json',
  'auth.json',
];
const IGNORE = /(__pycache__|\.pyc$|\.env$|endpoints\.json$|\.lock$|\.log$|\.DS_Store|\.swp$|~$|node_modules)/;

function log(line) {
  try {
    fs.appendFileSync(LOG, line + '\n');
  } catch (_) {
    /* 日志失败不影响主逻辑 */
  }
}

function shouldTrigger(filename) {
  if (!filename) return false;
  const rel = String(filename);
  if (rel.includes('.lock.d')) return false;
  if (IGNORE.test(rel)) return false;
  return INCLUDE.some((p) => rel === p || rel.startsWith(p + '/'));
}

let timer = null;
let running = false;
let pending = false;

function runSync(reason) {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  log(`[${new Date().toISOString()}] 触发同步（${reason}）`);
  const child = spawn('/bin/bash', [SYNC], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  child.on('close', (code) => {
    const tail = out.trim().split('\n').slice(-3).join(' | ');
    log(`[${new Date().toISOString()}] 完成 code=${code} ${tail}`);
    running = false;
    if (pending) {
      pending = false;
      runSync('pending 补跑');
    }
  });
  child.on('error', (err) => {
    log(`[${new Date().toISOString()}] 启动同步失败：${err.message}`);
    running = false;
  });
}

log(`[${new Date().toISOString()}] watcher 启动：监听 ${ROOT}（debounce ${DEBOUNCE_MS}ms）`);
watch(ROOT, { recursive: true }, (event, filename) => {
  if (!shouldTrigger(filename)) return;
  clearTimeout(timer);
  timer = setTimeout(() => runSync(`变化：${filename}`), DEBOUNCE_MS);
});
