// import { Button } from "@/components/ui/button";
// import { ModeToggle } from "@/components/ModeToggle";
import { HugeiconsIcon } from "@hugeicons/react";
import { Github01Icon } from "@hugeicons/core-free-icons";
import {
	Navbar as ResizableNavbar,
	NavBody,
	NavItems,
	MobileNav,
	NavbarLogo,
	NavbarButton,
	MobileNavHeader,
	MobileNavToggle,
	MobileNavMenu,
} from "@/components/resizable-navbar";
import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";

export default function Navbar() {
	const navItems = [
		{
			name: "Features",
			link: "/#features",
		},
		{
			name: "Extension",
			link: "/extension",
		},
	];
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	return (
		<ResizableNavbar>
			{/* Desktop Navigation */}
			<NavBody>
				<NavbarLogo />
				<NavItems items={navItems} />
				<div className="flex items-center gap-4">
					<ModeToggle />
					<NavbarButton
						variant="secondary"
						as="a"
						href="https://github.com/neosubhamoy/neodlp"
						target="_blank"
						aria-label="GitHub"
					>
						<HugeiconsIcon icon={Github01Icon} className="size-5" />
					</NavbarButton>
					<NavbarButton variant="primary" as="a" href="/download">
						Download
					</NavbarButton>
				</div>
			</NavBody>

			{/* Mobile Navigation */}
			<MobileNav>
				<MobileNavHeader>
					<NavbarLogo />
					<MobileNavToggle
						isOpen={isMobileMenuOpen}
						onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
					/>
				</MobileNavHeader>
				<MobileNavMenu
					isOpen={isMobileMenuOpen}
					onClose={() => setIsMobileMenuOpen(false)}
				>
					{navItems.map((item, idx) => (
						<a
							key={`mobile-link-${idx}`}
							href={item.link}
							onClick={() => setIsMobileMenuOpen(false)}
							className="relative text-neutral-600 dark:text-neutral-300"
						>
							<span className="block">{item.name}</span>
						</a>
					))}
					<div className="flex w-full flex-col gap-4">
						<NavbarButton
							onClick={() => setIsMobileMenuOpen(false)}
							variant="primary"
							className="w-full flex items-center justify-center gap-2"
							as="a"
							href="https://github.com/neosubhamoy/neodlp"
							target="_blank"
							aria-label="GitHub"
						>
							<HugeiconsIcon icon={Github01Icon} className="size-5" />
							View in GitHub
						</NavbarButton>
						<NavbarButton
							onClick={() => setIsMobileMenuOpen(false)}
							variant="primary"
							className="w-full"
							as="a"
							href="/download"
						>
							Download
						</NavbarButton>
					</div>
				</MobileNavMenu>
			</MobileNav>
		</ResizableNavbar>
		// <nav className="flex justify-between items-center border-b border-border sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 py-4 px-4 lg:px-12 xl:px-24">
		//     <a className="flex items-center gap-4" href="/">
		//         <div className="w-8">
		//             <img src="/neodlp.svg" alt="logo" />
		//         </div>
		//         <h1 className="text-2xl font-bold">NeoDLP</h1>
		//     </a>
		//     <div className="flex items-center gap-4">
		//         <Button variant="ghost" asChild>
		//             <a href="https://github.com/neosubhamoy/neodlp" target="_blank" aria-label="GitHub">
		//                 <Github className="h-4 w-4" />
		//             </a>
		//         </Button>
		//         <ModeToggle />
		//         <Button asChild>
		//             <a href="/download">Download</a>
		//         </Button>
		//     </div>
		// </nav>
	);
}
