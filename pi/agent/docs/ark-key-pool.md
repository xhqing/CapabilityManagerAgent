# Agent Plan Key 池（ark-key-pool）

为 `volcengine-agent-plan`（火山方舟 Agent Plan）提供**多 Key 自动切换**：配置两个来自不同账号的 Key，一个不能用时自动换另一个。

## 为什么需要

pi 原生的凭证模型是「一个 provider 一份凭证」（`auth.json` 里一条），原生不支持多 Key，也没有故障切换。Agent Plan 的额度耗尽（5 小时 / 每周）返回 `429 AccountQuotaExceeded`，Key 失效返回 `401`；pi 只会用同一个 Key 重试，切不到另一个账号。

## 怎么工作

扩展 `~/.pi/agent/extensions/ark-key-pool.ts` 挂三个钩子：

| 钩子 | 动作 |
|---|---|
| `before_provider_headers` | 每次请求前从池里挑一个可用 Key，覆盖 `Authorization` |
| `message_end` | 识别 401 / 403 / 429，给该 Key 写冷却（跨进程共享） |
| `before_agent_start` | 新一轮对话时清空本轮「已尝试」记录 |

两个关键点：

- **额度耗尽能自动切**：`429 AccountQuotaExceeded` 本来就是 pi 的可重试错误，pi 自动重试时会重新走 `before_provider_headers`，于是落到下一个 Key 上。
- **Key 失效也能自动切**：401 / 403 本身不让 pi 重试，扩展会把错误消息改写成可重试形态（带 `429`），让 pi 带着下一个 Key 重试。

## 配置

复制模板并填入真实 Key：

```bash
cp ~/.pi/agent/ark-agent-plan-keys.json.example ~/.pi/agent/ark-agent-plan-keys.json
chmod 600 ~/.pi/agent/ark-agent-plan-keys.json
```

```json
{
  "provider": "volcengine-agent-plan",
  "keys": [
    { "name": "主账号", "key": "sk-..." },
    { "name": "备用账号", "key": "sk-..." }
  ],
  "cooldown": {
    "authSeconds": 600,
    "rateLimitSeconds": 60,
    "quotaSeconds": 1800,
    "maxSeconds": 86400
  },
  "retryAuthErrors": true
}
```

- `keys` 至少 2 个才生效；1 个或配置不存在时扩展不介入，行为与原来一致。
- Key 按配置顺序使用：主 Key 冷却时才落到备用，到期自动回切。
- `cooldown.quotaSeconds` 是解析不到重置时间时的兜底；能解析到 `reset at …` 时按真实时间冷却，但不超过 `maxSeconds`（默认 1 天，避免周额度一停就是五天）。
- `retryAuthErrors: false` 可关闭「401 改写重试」，此时 Key 失效要等下一次请求才切换。

`auth.json` 里仍要保留至少一个 Agent Plan Key（或环境变量 `ARK_AGENT_PLAN_API_KEY`）——pi 在扩展介入前要先通过 provider 的凭证检查，否则会报「Provider is not configured」。池里的 Key 会覆盖它，两者可以重复。

## 命令

```
/ark-key-pool          # 查看各 Key 状态与冷却剩余时间
/ark-key-pool reset    # 清除全部冷却
```

## 状态与日志

- 状态：`~/.pi/agent/state/ark-key-pool.json`（只存 Key 的 SHA-256 前缀，不落明文）
- 日志：`~/.pi/agent/state/ark-key-pool.log`（超过 1MB 自动截断保留最后 2000 行）

状态跨进程共享：多个 pi 进程同时跑时，一个进程冷却掉的 Key，其他进程也会跳过。

## 已知边界

- **只对 `volcengine-agent-plan` 生效**，不改变其他 provider 的行为。
- **不改模型可见性**：两个账号套餐档位不同时（如一个 small 一个 medium），模型列表仍按 `auth.json` 里那个 Key 的档位展示；用备用 Key 调它没有的模型会得到 401/403 并触发冷却，属于预期行为。
- **依赖错误文本匹配**：pi 判断「可重试」靠错误消息里的关键词（429 等），这是 pi 的内部约定，大版本升级后建议回归验证一次。
- 冷却状态按 Key 的哈希记录，换 Key 内容后旧记录不再匹配（不影响使用，最多是旧条目残留）。

## 测试记录（2026-10-22）

用本地 mock 验证过四个场景，均通过：正常请求、额度耗尽切换、Key 失效切换、两个 Key 都耗尽；另验证了跨进程冷却共享与冷却到期自动恢复。
