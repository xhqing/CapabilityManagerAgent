/**
 * macmini-use 判定逻辑的回归测试（bun 直接跑，不加载 pi 运行时）。
 *
 * 用法：
 *   bun ~/.pi/agent/patch/macmini-use/test-classify.ts
 *
 * 说明：classify.ts 只依赖 node 内置模块，所以这里能直接 import。
 * 目的是锁住「哪些命令该拦、哪些不该拦」——拦截器和分流策略的真实行为由这套用例定义。
 */

import { detectHeavy, detectMirrorDelete, detectTaskSignals, isMacminiHost } from "../../extensions/macmini-use/classify.ts";

let failed = 0;
let passed = 0;

function eq(name: string, actual: unknown, expected: unknown): void {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	if (a === e) {
		passed += 1;
		return;
	}
	failed += 1;
	console.error(`❌ ${name}\n   期望: ${e}\n   实际: ${a}`);
}

function heavy(name: string, command: string, expected: boolean): void {
	const hit = detectHeavy(command);
	eq(`${name}（heavy=${expected}）`, Boolean(hit), expected);
}

// ---- isMacminiHost ----
eq("macmini host: Macs-Mac-mini.local", isMacminiHost("Macs-Mac-mini.local"), true);
eq("macmini host: mac-mini", isMacminiHost("mac-mini"), true);
eq("本机 host", isMacminiHost("xhqs-MacBook-Air.local"), false);

// ---- 应该拦下的重型命令 ----
heavy("cd 后 swift build", "cd ~/Developer/ghostty && swift build -c release", true);
heavy("cargo test", "cargo test --release 2>&1 | tail -20", true);
heavy("go build", "go build ./...", true);
heavy("cmake --build", "cmake --build build -j8", true);
heavy("ninja", "ninja -C build", true);
heavy("make -j8", "make -j8", true);
heavy("make -j 8", "make -j 8", true);
heavy("gradle build", "./gradlew build", true);
heavy("ffmpeg 转码", "ffmpeg -i in.mp4 -c:v libx264 out.mp4", true);
heavy("tesseract", "tesseract shot.png out", true);
heavy("环境变量前缀", "FOO=1 BAR=2 cargo build --release", true);
heavy("timeout 包装", "timeout 900 cargo test", true);
heavy("nice 包装", "nice -n 10 cargo build", true);
heavy("nohup 包装", "nohup ffmpeg -i a.mov b.mp4 &", true);

// ---- 不该拦的 ----
heavy("短命令", "git status --porcelain", false);
heavy("读文件", "cat README.md", false);
heavy("grep 提到 xcodebuild", "grep -rn xcodebuild .", false);
heavy("echo 提到 xcodebuild", "echo xcodebuild", false);
heavy("commit message 里提到", "git commit -m 'fix xcodebuild wrapper'", false);
heavy("已经在远端", "ssh mac-mini 'xcodebuild -list'", false);
heavy("macmini 透传", "macmini xcodebuild -list", false);
heavy("npm install（本地依赖常需要）", "npm ci --no-audit --no-fund", false);
heavy("npm run build（几秒级，交给判断）", "npm run build", false);
heavy("单文件 pytest", "python3 -m pytest tests/test_one.py -q", false);
heavy("make 无 -j", "make clean", false);
heavy("xcodebuild（macmini 无完整 Xcode，不往远端推）", "xcodebuild -scheme Foo build", false);
heavy("docker build（macmini daemon 不可用，不往远端推）", "docker build -t x .", false);
heavy("cd /tmp && rm", "cd /tmp && rm -rf x", false);

// ---- 远端递归删除 ----
const del = (name: string, command: string, cwd: string, expected: boolean): void => {
	eq(`${name}（block=${expected}）`, Boolean(detectMirrorDelete(command, cwd)), expected);
};
del("删 /tmp", "rm -rf /tmp/scratch", "/Users/mac/Developer/x", false);
del("在 /tmp 里删相对路径", "rm -rf scratch/data", "/tmp", false);
del("在仓库里删相对路径", "rm -rf build", "/Users/mac/Developer/x", true);
del("删仓库绝对路径", "rm -rf /Users/mac/Developer/x/tmp/cache", "/tmp", true);
del("删 ~/Developer", "rm -r ~/Developer/x/tmp/cache", "/tmp", true);
del("非递归 rm -f", "rm -f notes.md", "/Users/mac/Developer/x", false);
del("删本机 .pi", "rm -rf /Users/mac/.pi/agent/tmp/foo", "/tmp", true);

// ---- 指令里的重型特征（定向提醒用） ----
const sig = (name: string, prompt: string, expected: boolean): void => {
	const hits = detectTaskSignals(prompt);
	eq(`${name}（signal=${expected}）`, hits.length > 0, expected);
};
sig("编译指令", "帮我编译一下这个项目", true);
sig("全量测试", "跑一遍全量测试再提交", true);
sig("视频转码", "把这段视频转码成 mp4", true);
sig("策略回测", "用历史数据回测这个策略", true);
sig("下载模型", "下载这个模型到本地", true);
sig("识别文字", "识别这张截图里的文字", true);
sig("批量渲染", "把这 200 个 HTML 批量渲染成 PDF", true);
sig("写 README 不触发", "帮我写个 README", false);
sig("看 git 状态不触发", "看一下 git 状态", false);
sig("修 bug 不触发", "修一下这个 bug", false);
sig("跑单个测试文件不触发", "跑一下这个测试文件", false);

if (failed > 0) {
	console.error(`\n${failed} 个用例失败，${passed} 个通过`);
	process.exit(1);
}
console.log(`✅ 全部通过（${passed} 个用例）`);
