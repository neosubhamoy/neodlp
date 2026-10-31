import Footer from "@/components/footer";
import Header from "@/components/header";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import App from "@/entrypoints/popup/App";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<App>
			<div className="flex flex-col max-w-70 p-4 space-y-4">
				<Header />
				<Outlet />
				<Footer />
			</div>
		</App>
	);
}
