import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	AlertCircle,
	Loader2,
	Monitor,
	Moon,
	Search,
	Sun,
	type LucideIcon,
} from "lucide-react";
import type { Browser } from "wxt/browser";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { useForm, useSelector } from "@tanstack/react-form";
import { Field, FieldError } from "@/components/ui/field";
import type { Settings } from "@/types/index";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatKeySymbol } from "@/lib/utils";
import { useTheme } from "@/lib/theme-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { createFileRoute } from "@tanstack/react-router";

const searchFormSchema = z.object({
	url: z.url({
		error: (issue) =>
			issue.input === undefined || issue.input === null || issue.input === ""
				? "URL is required"
				: "Invalid URL format",
	}),
});

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const { setTheme } = useTheme();
	const [isSearching, setIsSearching] = useState(false);
	const [isLoadingSettings, setIsLoadingSettings] = useState(true);
	const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
	const [showNotRunningAlert, setShowNotRunningAlert] = useState(false);
	const [settings, setSettings] = useState<Settings>({
		theme: "system",
		autofill_url: true,
	});
	const [shortcuts, setShortcuts] = useState<Browser.commands.Command[]>([]);

	const themeOptions: {
		value: "system" | "dark" | "light";
		icon: LucideIcon;
		label: string;
	}[] = [
		{ value: "light", icon: Sun, label: "Light" },
		{ value: "dark", icon: Moon, label: "Dark" },
		{ value: "system", icon: Monitor, label: "System" },
	];

	const searchForm = useForm({
		defaultValues: {
			url: "",
		},
		validators: {
			onChange: searchFormSchema,
		},
		onSubmit: async ({ value }) => {
			handleSearchSubmit(value);
		},
	});
	const watchedUrl = useSelector(searchForm.store, (state) => state.values.url);
	const urlIsInvalid = useSelector(
		searchForm.store,
		(state) => state.fieldMeta.url?.isValid === false,
	);

	const handleSearch = async (url?: string) => {
		setIsSearching(true);
		setShowNotRunningAlert(false); // Reset alert status at the beginning

		// Create a timeout reference with undefined type
		let timeoutId: NodeJS.Timeout | undefined;

		try {
			const tabs = await new Promise<Browser.tabs.Tab[]>((resolve) => {
				browser.tabs.query({ active: true, currentWindow: true }, resolve);
			});

			const activeTab = tabs[0];

			// Create a race between the actual message and a timeout
			const response = await Promise.race([
				browser.runtime.sendMessage({
					action: "download",
					url: url ?? activeTab?.url,
				}),
				new Promise((_, reject) => {
					timeoutId = setTimeout(() => {
						reject(new Error("TIMEOUT"));
					}, 5000); // 5 second timeout
				}),
			]);

			// If we reach here, the request completed successfully
			if (timeoutId) clearTimeout(timeoutId);

			if (response) {
				console.log("Response from background script:", response);
			}
		} catch (error) {
			console.error("Search failed", error);

			// Check if this was a timeout error
			if (error instanceof Error && error.message === "TIMEOUT") {
				setShowNotRunningAlert(true);
			}

			// Clear the timeout if it was some other error
			if (timeoutId) clearTimeout(timeoutId);
		} finally {
			setIsSearching(false);
		}
	};

	const handleSearchSubmit = async (
		values: z.infer<typeof searchFormSchema>,
	) => {
		await handleSearch(values.url);
	};

	const saveSettings = async <K extends keyof Settings>(
		key: K,
		value: Settings[K],
	) => {
		setIsUpdatingSettings(true);
		try {
			// First, get current settings from storage
			const result = await browser.storage.local.get("settings");
			const currentSettings = result.settings || {};

			// Update with new value
			const updatedSettings = {
				...currentSettings,
				[key]: value,
			};

			// Save to storage
			await browser.storage.local.set({ settings: updatedSettings });

			// Update state if save was successful
			setSettings((prevSettings) => ({
				...prevSettings,
				[key]: value,
			}));

			console.log(`Settings ${key} updated to:`, value);
		} catch (error) {
			console.error(`Failed to save settings ${key}:`, error);
		} finally {
			setIsUpdatingSettings(false);
		}
	};

	// Fetch all Commands when the component mounts
	useEffect(() => {
		browser.commands
			.getAll()
			.then((commands) => {
				setShortcuts(commands);
			})
			.catch(console.error);
	}, []);

	// loading the settings from storage if available, overwriting the default values when the component mounts
	useEffect(() => {
		const loadSettings = async () => {
			try {
				const result = await browser.storage.local.get("settings");
				if (result.settings) {
					// Merge saved settings with default settings
					// Only override keys that exist in saved settings, keeping defaults otherwise
					setSettings((prevSettings) => ({
						...prevSettings,
						...result.settings,
					}));
				}
			} catch (error) {
				console.error("Failed to load settings:", error);
			} finally {
				setIsLoadingSettings(false);
			}
		};
		loadSettings();
	}, []);

	// Auto-fill the URL field with the active tab's URL when the component mounts (if autofill is enabled)
	useEffect(() => {
		console.log({ isLoadingSettings, settings });
		const autoFillUrl = async () => {
			const tabs = await new Promise<Browser.tabs.Tab[]>((resolve) => {
				browser.tabs.query({ active: true, currentWindow: true }, resolve);
			});
			const activeTab = tabs[0];
			if (activeTab && activeTab.url) {
				searchForm.setFieldValue("url", activeTab.url);
				await searchForm.validateField("url", "change");
			}
		};
		if (!isLoadingSettings && settings.autofill_url) {
			autoFillUrl();
		}
	}, [isLoadingSettings, settings.autofill_url]);

	// Listen for tab URL changes and update the form value accordingly (if autofill is enabled)
	useEffect(() => {
		if (isLoadingSettings || !settings.autofill_url) return;
		const handleTabUrlChange = async (
			tabId: number,
			changeInfo: Browser.tabs.OnUpdatedInfo,
		) => {
			if (changeInfo.status === "complete") {
				browser.tabs.get(tabId).then(async (tab) => {
					if (tab.active && tab.url) {
						searchForm.setFieldValue("url", tab.url);
						await searchForm.validateField("url", "change");
					}
				});
			}
		};
		browser.tabs.onUpdated.addListener(handleTabUrlChange);
		return () => {
			browser.tabs.onUpdated.removeListener(handleTabUrlChange);
		};
	}, [isLoadingSettings, settings.autofill_url]);

	// Update the theme when settings change
	useEffect(() => {
		const updateTheme = async () => {
			setTheme(settings.theme);
		};
		updateTheme().catch(console.error);
	}, [settings.theme]);

	return (
		<div className="content flex flex-col space-y-4 w-full">
			<div className="theme-selection flex items-center justify-center">
				<div className={cn("inline-flex gap-1 rounded-lg p-1 bg-muted")}>
					{themeOptions.map(({ value, icon: Icon, label }) => (
						<button
							key={value}
							onClick={() => saveSettings("theme", value)}
							className={cn(
								"flex items-center rounded-md px-[0.80rem] py-1.5 transition-colors",
								settings.theme === value
									? "bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100"
									: "text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60",
							)}
						>
							<Icon className="-ml-1 h-4 w-4" />
							<span className="ml-1.5 text-xs">{label}</span>
						</button>
					))}
				</div>
			</div>
			<div className="autofill-url flex items-center justify-center gap-4">
				<Switch
					id="autofill-url"
					checked={settings.autofill_url}
					onCheckedChange={(checked) => saveSettings("autofill_url", checked)}
				/>
				<Label htmlFor="autofill-url">AutoFill Page URL</Label>
			</div>
			<form
				id="search-form"
				className="flex flex-col gap-4 w-full"
				autoComplete="off"
				onSubmit={(e) => {
					e.preventDefault();
					searchForm.handleSubmit();
				}}
			>
				<searchForm.Field
					name="url"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid} className="w-full">
								<Textarea
									className="w-full h-28 resize-none text-sm"
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									readOnly={settings.autofill_url}
									disabled={
										isSearching || isLoadingSettings || isUpdatingSettings
									}
									aria-invalid={isInvalid}
									placeholder="Enter URL"
									autoComplete="off"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
								{showNotRunningAlert && (
									<Alert variant="destructive" className="mt-2">
										<AlertCircle className="h-4 w-4" />
										<AlertTitle>Host Error</AlertTitle>
										<AlertDescription className="text-xs">
											Make sure NeoDLP is Installed and Running
										</AlertDescription>
									</Alert>
								)}
							</Field>
						);
					}}
				/>
				<Button
					className="w-full cursor-pointer"
					type="submit"
					disabled={
						isSearching ||
						isLoadingSettings ||
						isUpdatingSettings ||
						!watchedUrl ||
						urlIsInvalid
					}
				>
					{isSearching ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin" />
							Initiating
						</>
					) : (
						<>
							<Search className="w-4 h-4" />
							Search
						</>
					)}
				</Button>
			</form>
			<div className="or-devider after:border-border relative text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t mb-2">
				<span className="bg-background text-muted-foreground relative z-10 px-2">
					OR
				</span>
			</div>
			<div className="quick-search-suggestion flex flex-col items-center justify-center space-y-2">
				<p className="text-sm flex items-center gap-2">
					<span className="">Use, Shortcut</span>
					{shortcuts.find((cmd) => cmd.name === "neodlp:quick-search")
						?.shortcut ? (
						<KbdGroup>
							{shortcuts
								.find((cmd) => cmd.name === "neodlp:quick-search")
								?.shortcut?.split("+")
								.map((key, index, arr) => (
									<span key={index} className="flex items-center">
										<Kbd>{formatKeySymbol(key.trim())}</Kbd>
										{index < arr.length - 1 && <span className="ml-1">+</span>}
									</span>
								))}
						</KbdGroup>
					) : (
						<Kbd>⚠️ Not Set</Kbd>
					)}
				</p>
			</div>
		</div>
	);
}
