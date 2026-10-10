export function NeoDlpIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 1024 1024"
			xmlns="http://www.w3.org/2000/svg"
			width="1024"
			height="1024"
			{...props}
		>
			<title>NeoDLP</title>
			<rect width="1024" height="1024" fill="url(#paint0_linear_10_2)" />
			<path
				d="M529.252 811.098C519.472 820.96 503.528 820.96 493.748 811.098L256.265 571.603C240.619 555.824 251.796 529 274.017 529H748.983C771.204 529 782.381 555.824 766.735 571.603L529.252 811.098Z"
				fill="#FAFAFA"
			/>
			<rect x="355" y="222" width="313" height="346" rx="25" fill="#FAFAFA" />
			<defs>
				<linearGradient
					id="paint0_linear_10_2"
					x1="129.5"
					y1="148.5"
					x2="921"
					y2="863"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="var(--logo-stop-color-1)" />
					<stop offset="1" stopColor="var(--logo-stop-color-2)" />
				</linearGradient>
			</defs>
		</svg>
	);
}

export function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 16 16"
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			{...props}
		>
			<title>Close</title>
			<path
				fill="currentColor"
				fillRule="evenodd"
				d="m7.116 8l-4.558 4.558l.884.884L8 8.884l4.558 4.558l.884-.884L8.884 8l4.558-4.558l-.884-.884L8 7.116L3.442 2.558l-.884.884z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

export function MaximizeIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 16 16"
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			{...props}
		>
			<title>Maximize</title>
			<path fill="currentColor" d="M3 3v10h10V3zm9 9H4V4h8z" />
		</svg>
	);
}

export function UnmaximizeIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 16 16"
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			{...props}
		>
			<title>Unmaximize</title>
			<g fill="currentColor">
				<path d="M3 5v9h9V5zm8 8H4V6h7z" />
				<path
					fillRule="evenodd"
					d="M5 5h1V4h7v7h-1v1h2V3H5z"
					clipRule="evenodd"
				/>
			</g>
		</svg>
	);
}

export function MinimizeIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 16 16"
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			{...props}
		>
			<title>Minimize</title>
			<path fill="currentColor" d="M14 8v1H3V8z" />
		</svg>
	);
}

export function IndianFlagIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="-45 -30 90 60"
			xmlns="http://www.w3.org/2000/svg"
			xmlnsXlink="http://www.w3.org/1999/xlink"
			fill="#07038D"
			width="1024"
			height="1024"
			{...props}
		>
			<title>Indian Flag</title>
			<path fill="#FFF" d="m-45-30h90v60h-90z" />
			<path fill="#FF6820" d="m-45-30h90v20h-90z" />
			<path fill="#046A38" d="m-45 10h90v20h-90z" />
			<circle r="9.25" />
			<circle fill="#FFF" r="8" />
			<circle r="1.6" />
			<g id="d">
				<g id="c">
					<g id="b">
						<g id="a">
							<path d="m0-8 .3 4.81409L0-.80235-.3-3.18591z" />
							<circle transform="rotate(7.5)" r="0.35" cy="-8" />
						</g>
						<use xlinkHref="#a" transform="scale(-1)" />
					</g>
					<use xlinkHref="#b" transform="rotate(15)" />
				</g>
				<use xlinkHref="#c" transform="rotate(30)" />
			</g>
			<use xlinkHref="#d" transform="rotate(60)" />
			<use xlinkHref="#d" transform="rotate(120)" />
		</svg>
	);
}
