import { afterEach, describe, expect, it, vi } from "bun:test";
import {
	type AppViewportScrollRegion,
	type Component,
	CURSOR_MARKER,
	type Focusable,
	matchesKey,
	TUI,
} from "@oh-my-pi/pi-tui";
import { StressRenderScheduler } from "./render-stress-scheduler";
import { VirtualTerminal } from "./virtual-terminal";

class TranscriptProbe implements Component, AppViewportScrollRegion {
	#lines: string[];

	constructor(lines: string[]) {
		this.#lines = [...lines];
	}

	append(...lines: string[]): void {
		this.#lines.push(...lines);
	}

	getAppViewportScrollRegionEnd(): number | undefined {
		return this.#lines.length;
	}

	invalidate(): void {}

	render(): readonly string[] {
		return [...this.#lines];
	}
}

class MutableLine implements Component {
	constructor(public text: string) {}

	invalidate(): void {}

	render(): readonly string[] {
		return this.text.split("\n");
	}
}

class EditorProbe implements Component, Focusable {
	focused = false;
	text: string;
	readonly inputs: string[] = [];

	constructor(text: string) {
		this.text = text;
	}

	handleInput(data: string): void {
		this.inputs.push(data);
		if (data.length === 1) this.text += data;
	}

	invalidate(): void {}

	render(): readonly string[] {
		return [`> ${this.text}${this.focused ? CURSOR_MARKER : ""}`];
	}
}

function visible(term: VirtualTerminal): string[] {
	return term.getViewport().map(line => Bun.stripANSI(line).trimEnd());
}

function captureWrites(term: VirtualTerminal): string[] {
	const writes: string[] = [];
	const realWrite = term.write.bind(term);
	vi.spyOn(term, "write").mockImplementation((data: string) => {
		writes.push(data);
		realWrite(data);
	});
	return writes;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("TUI app viewport backend", () => {
	it("keeps chrome and editor input fixed while transcript history scrolls", async () => {
		const term = new VirtualTerminal(30, 8, 200);
		const scheduler = new StressRenderScheduler();
		const tui = new TUI(term, true, { renderBackend: "app-viewport", renderScheduler: scheduler });
		const transcript = new TranscriptProbe(Array.from({ length: 12 }, (_value, index) => `t${index}`));
		const status = new MutableLine("STATUS");
		const editor = new EditorProbe("ab");
		tui.addChild(transcript);
		tui.addChild(status);
		tui.addChild(editor);
		tui.setFocus(editor);
		const writes = captureWrites(term);
		let stopped = false;

		try {
			tui.start();
			await scheduler.drain(term);
			expect(visible(term)).toEqual(["t6", "t7", "t8", "t9", "t10", "t11", "STATUS", "> ab"]);
			expect(term.getCursor()).toEqual({ row: 7, col: 4 });
			expect(term.getBufferPosition()).toEqual({ baseY: 0, viewportY: 0 });

			term.sendInput("\x1b[<64;1;1M");
			await scheduler.drain(term);
			expect(visible(term)).toEqual(["t3", "t4", "t5", "t6", "t7", "t8", "STATUS", "> ab"]);
			expect(editor.inputs).toEqual([]);
			expect(term.getCursor()).toEqual({ row: 7, col: 4 });

			term.sendInput("X");
			await scheduler.drain(term);
			expect(editor.inputs).toEqual(["X"]);
			expect(visible(term)).toEqual(["t3", "t4", "t5", "t6", "t7", "t8", "STATUS", "> abX"]);
			expect(term.getCursor()).toEqual({ row: 7, col: 5 });

			transcript.append("t12", "t13");
			status.text = "BUSY";
			tui.requestRender();
			await scheduler.drain(term);
			expect(visible(term)).toEqual(["t3", "t4", "t5", "t6", "t7", "t8", "BUSY", "> abX"]);
			expect(term.getBufferPosition()).toEqual({ baseY: 0, viewportY: 0 });
			expect(writes.join("")).not.toContain("\x1b[3J");

			const altEnd = "\x1b[1;3F";
			expect(matchesKey(altEnd, "alt+end")).toBeTrue();
			term.sendInput(altEnd);
			await scheduler.drain(term);
			expect(visible(term)).toEqual(["t8", "t9", "t10", "t11", "t12", "t13", "BUSY", "> abX"]);

			transcript.append("t14");
			tui.requestRender();
			await scheduler.drain(term);
			expect(visible(term)).toEqual(["t9", "t10", "t11", "t12", "t13", "t14", "BUSY", "> abX"]);

			tui.stop();
			stopped = true;
			tui.stop();
			const output = writes.join("");
			expect(output.split("\x1b[?1049h")).toHaveLength(2);
			expect(output.split("\x1b[?1049l")).toHaveLength(2);
		} finally {
			if (!stopped) tui.stop();
		}
	});

	it("keeps the bottommost chrome rows when chrome exceeds the viewport", async () => {
		const term = new VirtualTerminal(30, 3, 20);
		const scheduler = new StressRenderScheduler();
		const tui = new TUI(term, true, { renderBackend: "app-viewport", renderScheduler: scheduler });
		const editor = new EditorProbe("draft");
		tui.addChild(new TranscriptProbe(["history"]));
		tui.addChild(new MutableLine("hud-0\nhud-1\nhud-2\nhud-3"));
		tui.addChild(editor);
		tui.setFocus(editor);

		try {
			tui.start();
			await scheduler.drain(term);
			expect(visible(term)).toEqual(["hud-2", "hud-3", "> draft"]);
			expect(term.getCursor()).toEqual({ row: 2, col: 7 });
		} finally {
			tui.stop();
		}
	});
});
