import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export default function RootLayout() {
    return (
        <>
        <div className="flex flex-col min-h-screen">
            <SidebarProvider>
                <AppSidebar />
                <div className="w-full h-screen overflow-y-scroll no-scrollbar relative">
                    <Navbar/>
                    <Outlet />
                    <Footer/>
                </div>
            </SidebarProvider>
        </div>
        </>
    );
}
