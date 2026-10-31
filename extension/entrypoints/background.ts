import type { WebsocketMessage } from "@/types/index";

export default defineBackground(() => {
	const sendMessageToNativeHost = (message: WebsocketMessage) => {
		return new Promise((resolve, reject) => {
			let port = browser.runtime.connectNative("com.neosubhamoy.neodlp");

			port.onMessage.addListener((response) => {
				console.log("Received from native host:", response);
				if (response.status === "success") {
					resolve(response.response);
				} else if (response.status === "error") {
					reject(new Error(response.message));
				}
			});

			port.onDisconnect.addListener(() => {
				if (browser.runtime.lastError) {
					reject(new Error(browser.runtime.lastError.message));
				}
			});

			port.postMessage(message);
		});
	};

	// Listen for messages from the popup or content scripts
	browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === "download") {
			const url = request.url;
			sendMessageToNativeHost({
				url: url,
				command: "download",
				argument: "",
			}).then((response) => sendResponse(response));
			return true; // Keep the message channel open for sendResponse to be called asynchronously
		}
	});

	// Listen for the keyboard commands
	browser.commands.onCommand.addListener(async (command) => {
		if (command === "neodlp:quick-search") {
			try {
				const tabs = await browser.tabs.query({
					active: true,
					currentWindow: true,
				});
				const activeTab = tabs[0];

				if (activeTab && activeTab.url) {
					console.log("Quick search triggered for URL:", activeTab.url);

					const response = await sendMessageToNativeHost({
						url: activeTab.url,
						command: "download",
						argument: "",
					});

					console.log("Quick search response:", response);
				} else {
					console.error("No active tab or URL found for quick search");
				}
			} catch (error) {
				console.error("Error in quick search:", error);
			}
		}
	});

	// Clear existing context menus before creating new ones
	browser.contextMenus.removeAll().then(() => {
		// Context menu for quick download
		browser.contextMenus.create({
			id: "quick-search:page",
			title: "Search with Neo Downloader Plus",
			contexts: ["page"],
		});

		browser.contextMenus.create({
			id: "quick-search:link",
			title: "Search with Neo Downloader Plus (Link)",
			contexts: ["link"],
		});

		browser.contextMenus.create({
			id: "quick-search:media",
			title: "Search with Neo Downloader Plus (Media Source)",
			contexts: ["video", "audio"],
		});

		browser.contextMenus.create({
			id: "quick-search:selection",
			title: "Search with Neo Downloader Plus (Selected Text)",
			contexts: ["selection"],
		});
	});

	browser.contextMenus.onClicked.addListener((info, tab) => {
		let url = "";
		if (info.menuItemId === "quick-search:page") {
			if (!info.pageUrl) return;
			url = info.pageUrl;
		} else if (info.menuItemId === "quick-search:link") {
			if (!info.linkUrl) return;
			url = info.linkUrl;
		} else if (info.menuItemId === "quick-search:media") {
			if (!info.srcUrl) return;
			url = info.srcUrl;
		} else if (info.menuItemId === "quick-search:selection") {
			if (!info.selectionText) return;
			url = info.selectionText;
		}
		if (!url) return;
		sendMessageToNativeHost({ url: url, command: "download", argument: "" })
			.then((response) => {
				console.log("Context menu search response:", response);
			})
			.catch((error) => {
				console.error("Error in context menu search:", error);
			});
	});
});
