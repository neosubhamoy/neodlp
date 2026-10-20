// What happens after the backend copies the integration files into place. The copying itself lives
// in src-tauri/src/tools/register.rs; these flows only sequence the follow-up steps.

export interface RegistrationResult {
	success: boolean;
	message: string;
}

const REGISTERED: RegistrationResult = {
	success: true,
	message: "Registered successfully",
};
const FAILED: RegistrationResult = {
	success: false,
	message: "Failed to register",
};

export async function registerForMacos(deps: {
	register: () => Promise<void>;
	/** Remembers which app version was registered. */
	saveVersion: () => void;
}): Promise<RegistrationResult> {
	try {
		await deps.register();
		deps.saveVersion();
		return REGISTERED;
	} catch (error) {
		console.error("Error registering:", error);
		return FAILED;
	}
}

export async function registerForLinux(deps: {
	register: () => Promise<void>;
	saveVersion: () => void;
	isFlatpak: () => Promise<boolean>;
	updateYtDlp: () => Promise<void>;
}): Promise<RegistrationResult> {
	try {
		await deps.register();
		deps.saveVersion();
		// Flatpak just installed its own copy of yt-dlp, which should be brought up to date.
		if (await deps.isFlatpak()) {
			await deps.updateYtDlp();
		}
		return REGISTERED;
	} catch (error) {
		console.error("Error registering:", error);
		return FAILED;
	}
}
