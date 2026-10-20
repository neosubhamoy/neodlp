import { describe, expect, it, vi } from "vitest";
import { registerForLinux, registerForMacos } from "./registration";

function deps(overrides: Partial<Parameters<typeof registerForLinux>[0]> = {}) {
	return {
		register: vi.fn().mockResolvedValue(undefined),
		saveVersion: vi.fn(),
		isFlatpak: vi.fn().mockResolvedValue(false),
		updateYtDlp: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("registerForMacos", () => {
	it("registers, then records the app version", async () => {
		const register = vi.fn().mockResolvedValue(undefined);
		const saveVersion = vi.fn();
		const result = await registerForMacos({ register, saveVersion });
		expect(result).toEqual({
			success: true,
			message: "Registered successfully",
		});
		expect(register).toHaveBeenCalledTimes(1);
		expect(saveVersion).toHaveBeenCalledTimes(1);
	});

	it("does not record the version when registering fails", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const saveVersion = vi.fn();
		const result = await registerForMacos({
			register: vi
				.fn()
				.mockRejectedValue("Failed to copy neodlp-autostart.plist"),
			saveVersion,
		});
		expect(result).toEqual({ success: false, message: "Failed to register" });
		expect(saveVersion).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});

describe("registerForLinux", () => {
	it("registers and records the version without updating yt-dlp outside Flatpak", async () => {
		const d = deps();
		const result = await registerForLinux(d);
		expect(result).toEqual({
			success: true,
			message: "Registered successfully",
		});
		expect(d.register).toHaveBeenCalledTimes(1);
		expect(d.saveVersion).toHaveBeenCalledTimes(1);
		expect(d.updateYtDlp).not.toHaveBeenCalled();
	});

	it("updates yt-dlp after registering under Flatpak (its own copy was just installed)", async () => {
		const order: string[] = [];
		const d = deps({
			isFlatpak: vi.fn().mockResolvedValue(true),
			register: vi
				.fn()
				.mockImplementation(async () => void order.push("register")),
			saveVersion: vi.fn().mockImplementation(() => void order.push("save")),
			updateYtDlp: vi
				.fn()
				.mockImplementation(async () => void order.push("update")),
		});
		const result = await registerForLinux(d);
		expect(result.success).toBe(true);
		expect(order).toEqual(["register", "save", "update"]);
	});

	it("neither records nor updates when registering fails", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const d = deps({
			isFlatpak: vi.fn().mockResolvedValue(true),
			register: vi.fn().mockRejectedValue("Failed to copy yt-dlp"),
		});
		const result = await registerForLinux(d);
		expect(result).toEqual({ success: false, message: "Failed to register" });
		expect(d.saveVersion).not.toHaveBeenCalled();
		expect(d.updateYtDlp).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});
