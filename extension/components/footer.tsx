export default function Footer() {
	const manifest = browser.runtime.getManifest();

	return (
		<footer className="flex flex-col items-center justify-center text-center w-full">
			<p className="text-xs text-muted-foreground">
				<a href={manifest.homepage_url} target="_blank" className="">
					NeoDLP Extension
				</a>{" "}
				&copy; {new Date().getFullYear()} -{" "}
				<a
					href="https://github.com/neosubhamoy/neodlp-extension/blob/main/LICENSE"
					target="_blank"
				>
					MIT License
				</a>{" "}
				<br></br> Made with ❤️ by{" "}
				<a href="https://neosubhamoy.com" target="_blank">
					Subhamoy
				</a>
			</p>
		</footer>
	);
}
