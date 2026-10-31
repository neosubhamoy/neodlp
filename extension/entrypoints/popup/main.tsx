import React from "react";
import ReactDOM from "react-dom/client";
import "@/entrypoints/popup/style.css";
import {
	RouterProvider,
	createHashHistory,
	createRouter,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
	routeTree,
	history: createHashHistory(),
	defaultPreload: "intent",
	scrollRestoration: true,
});

// Register things for typesafety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>,
);
