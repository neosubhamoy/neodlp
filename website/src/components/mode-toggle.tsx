import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { NavbarButton } from "@/components/resizable-navbar";

export function ModeToggle() {
	const [isDark, setIsDark] = React.useState(false);

	React.useEffect(() => {
		setIsDark(document.documentElement.classList.contains("dark"));
	}, []);

	const toggleTheme = () => {
		const newIsDark = !isDark;
		setIsDark(newIsDark);
		document.documentElement.classList[newIsDark ? "add" : "remove"]("dark");
		localStorage.setItem("theme", newIsDark ? "dark" : "light");
	};

	return (
		<NavbarButton
			variant="secondary"
			as="button"
			className="flex justify-center items-center"
			onClick={toggleTheme}
		>
			<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</NavbarButton>
	);
}
