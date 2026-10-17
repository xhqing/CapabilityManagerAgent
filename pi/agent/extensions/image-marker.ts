/**
 * 粘贴图片精简显示（pi 端输入框显示优化，2026-10-12 立）。
 *
 * 背景：pi 里 Ctrl+V 粘贴剪贴板图片时，输入框中插入的是临时文件的绝对路径
 * （/var/folders/.../pi-clipboard-<uuid>.png）——路径又长又占地方，贴几张图就
 * 看不清自己到底贴了什么。本扩展把这类粘贴的图片路径折叠成 `[Image #1]`
 * 标记显示（与粘贴大段文本时的 `[paste #1 +30 lines]` 是同一套折叠机制），
 * 按下回车提交时再把标记还原成真实路径，对下游完全透明：模型 / 工具拿到的
 * 仍是真实路径，`read` 图片、后续引用文件等行为一律不变。
 *
 * 编号规则：同一条消息内按粘贴顺序从 #1 开始编号，回车提交后下一条消息重新
 * 从 #1 开始；连着贴两张图时自动空格分隔，
 * 展开后是两条独立路径（不会粘成 a.pngb.png 一条无效路径）。
 *
 * 实现要点：pi-tui 的 Editor 内置了「粘贴折叠 + 提交时展开」机制，本扩展搭它的车。
 * 依赖 Editor 的五个方法（升级 pi 后若行为异常，先核对这几个方法是否改名 / 改签名）：
 * - insertTextAtCursor()：Ctrl+V 粘贴图片的落点（handleClipboardPaste → editor），
 *   图片路径在这里换成标记；
 * - handlePaste()：终端直接发括号粘贴序列（Cmd+V 直通、复制文件后粘贴路径）的落点；
 * - expandPasteMarkers()：Editor 的 submitValue()（回车提交）与 getExpandedText()
 *   都调用它，标记在这里还原成路径——这是「送出的文本仍是真实路径」的关键；
 * - submitValue()：回车提交，在这里把编号归零（下一条消息从 #1 重新开始）；
 * - setTextInternal()：编辑器文本被回填的落点（历史记录上下翻阅、恢复排队消息、
 *   fork 选中消息、外部编辑器返回、会话切换），把真实路径重新折叠成标记。
 *
 * 只对「整段文本就是一张已存在图片文件的路径」生效（单行、.png/.jpg/.gif/.webp/
 * .bmp/.tif 结尾、文件真实存在），普通文本粘贴、普通命令、代码片段一律不受影响。
 */

import { existsSync, statSync } from "node:fs";
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 图片扩展名（判断「这段文本是不是图片路径」用） */
const IMAGE_PATH_RE = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;
/** 单条路径长度上限，超长的不当路径处理（避免对超长文本做文件系统探测） */
const MAX_PATH_LENGTH = 4096;

/** 会话内见过的图片路径（或带引号的路径原文），回填文本重新折叠时按它认人 */
const knownValues = new Set<string>();
/** 当前这条消息：路径原文 → 编号 */
const idByValue = new Map<string, number>();
/** 当前这条消息：编号 → 路径原文 */
const valueById = new Map<number, string>();
let counter = 0;

function marker(id: number): string {
	return `[Image #${id}]`;
}

/** 去掉包裹路径的一对引号（macOS 拖拽 / 复制文件常带引号） */
function stripQuotes(text: string): string {
	if (text.length >= 2) {
		const first = text[0];
		const last = text[text.length - 1];
		if ((first === '"' || first === "'") && last === first) {
			return text.slice(1, -1);
		}
	}
	return text;
}

/**
 * 判断一段粘贴文本是不是「一张图片文件的路径」。
 * 是则返回该文本（去首尾空白后的原文，展开时原样还原），否则返回 undefined。
 */
function imagePasteValue(text: unknown): string | undefined {
	if (typeof text !== "string") return undefined;
	const value = text.trim();
	if (!value || value.length > MAX_PATH_LENGTH) return undefined;
	if (value.includes("\n")) return undefined;
	if (!IMAGE_PATH_RE.test(stripQuotes(value))) return undefined;
	try {
		const path = stripQuotes(value);
		if (!existsSync(path) || !statSync(path).isFile()) return undefined;
	} catch {
		return undefined;
	}
	return value;
}

/** 取得该路径对应的标记（同一条消息内重复粘贴同一路径复用同一编号） */
function markerFor(value: string): string {
	knownValues.add(value);
	let id = idByValue.get(value);
	if (id === undefined) {
		id = ++counter;
		idByValue.set(value, id);
		valueById.set(id, value);
	}
	return marker(id);
}

/** 把文本里的 `[Image #N]` 标记还原成真实路径 */
function expandMarkers(text: string): string {
	let result = text;
	for (const [id, value] of valueById) {
		const mark = marker(id);
		if (result.includes(mark)) {
			result = result.split(mark).join(value);
		}
	}
	return result;
}

/** 把文本里已知的图片路径折叠成标记（回填编辑器内容时用，必要时分配新编号） */
function collapseValues(text: string): string {
	let result = text;
	for (const value of [...knownValues]) {
		if (result.includes(value)) {
			result = result.split(value).join(markerFor(value));
		}
	}
	return result;
}

class ImageMarkerEditor extends CustomEditor {
	/**
	 * 光标前一个字符不是空白时，标记前面补一个空格。
	 * 目的：连着贴两张图时显示成 `[Image #1] [Image #2]`，展开后是两条独立路径
	 * （否则会粘成 `a.pngb.png` 一条无效路径）。
	 */
	private markerText(value: string): string {
		const mark = markerFor(value);
		try {
			const editor = this as unknown as {
				getCursor(): { line: number; col: number };
				getLines(): string[];
			};
			const { line, col } = editor.getCursor();
			const before = (editor.getLines()[line] ?? "").slice(0, col);
			const prev = before.slice(-1);
			if (prev && !/\s/.test(prev)) return ` ${mark}`;
		} catch {
			// 取光标信息失败就按不加空格插入
		}
		return mark;
	}

	/** Ctrl+V 粘贴图片 / 剪贴板文本的落点 */
	insertTextAtCursor(text: string): void {
		const value = imagePasteValue(text);
		super.insertTextAtCursor(value ? this.markerText(value) : text);
	}

	/** 终端括号粘贴（Cmd+V 直通、复制文件后粘贴路径）的落点 */
	handlePaste(pastedText: string): void {
		const value = imagePasteValue(pastedText);
		super.handlePaste(value ? this.markerText(value) : pastedText);
	}

	/** 回车提交与 getExpandedText() 都会走这里：标记 → 真实路径 */
	expandPasteMarkers(text: string): string {
		return expandMarkers(super.expandPasteMarkers(text));
	}

	/** 回车提交后编号归零：下一条消息的图片重新从 [Image #1] 开始 */
	submitValue(): void {
		super.submitValue();
		idByValue.clear();
		valueById.clear();
		counter = 0;
	}

	/** 编辑器内容被回填（历史翻阅 / 恢复排队消息 / fork / 外部编辑器）时重新折叠 */
	setTextInternal(text: string, cursorPlacement?: "start" | "end"): void {
		super.setTextInternal(typeof text === "string" ? collapseValues(text) : text, cursorPlacement);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setEditorComponent((tui, theme, keybindings) => new ImageMarkerEditor(tui, theme, keybindings));
	});
}
