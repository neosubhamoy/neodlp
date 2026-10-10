import { Outlet, createRootRoute } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { PacerDevtoolsPanel } from "@tanstack/react-pacer-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
import App from "@/App";

export const Route = createRootRoute({
	component: Root,
	notFoundComponent: () => <div>404 Not Found</div>,
});

function Root() {
	return (
		<App>
			<div className="flex flex-col min-h-screen">
				<SidebarProvider>
					<AppSidebar />
					<div className="w-full h-screen overflow-y-scroll no-scrollbar relative">
						<Navbar />
						<Outlet />
						<Footer />
					</div>
				</SidebarProvider>
			</div>
			<TanStackDevtools
				eventBusConfig={{
					debug: false,
				}}
				plugins={[
					{
						name: "TanStack Query",
						render: <ReactQueryDevtoolsPanel />,
						defaultOpen: true,
					},
					{
						name: "TanStack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
					{
						name: "TanStack Form",
						render: <FormDevtoolsPanel />,
					},
					{
						name: "TanStack Pacer",
						render: <PacerDevtoolsPanel />,
					},
				]}
			/>
		</App>
	);
}
