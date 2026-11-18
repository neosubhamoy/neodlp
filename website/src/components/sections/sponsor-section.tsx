import { SignPathLogo, ProxySellerLogo } from "@/components/icons";

export default function SponsorSection() {
	return (
		<section className="flex flex-col w-full mb-16" id="sponsors">
			<div className="flex flex-col items-center justify-center gap-2 pt-40 pb-16">
				<h3 className="text-3xl lg:text-4xl font-bold">Sponsors</h3>
				<p className="text-sm lg:text-lg font-semibold text-muted-foreground">
					Check-out our sponsors :)
				</p>
			</div>
			<div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-6">
				<a
					href="https://signpath.io/?utm_source=neodlp.neosubhamoy.com"
					target="_blank"
				>
					<SignPathLogo className="w-60 lg:ml-16" />
				</a>
				<a
					href="https://proxy-seller.com/?partner=X1YG6981E2F84L"
					target="_blank"
				>
					<ProxySellerLogo className="w-100" />
				</a>
			</div>
		</section>
	);
}
