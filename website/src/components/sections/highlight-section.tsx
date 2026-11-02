import { WobbleCard } from "@/components/wobble-card";

export default function HighlightSection() {
	return (
		<section className="flex flex-col w-full mb-20">
			<div className="flex flex-col relative">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto w-full px-4">
					<WobbleCard
						containerClassName="col-span-1 lg:col-span-2 h-full bg-pink-800 min-h-[500px] lg:min-h-[300px]"
						className=""
					>
						<div className="max-w-xs">
							<h2 className="text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
								Mange all your downloads in one place
							</h2>
							<p className="mt-4 text-left  text-base/6 text-neutral-200">
								NeoDLP Library helps you manage and organize all your downloads
								in one place for better productivity.
							</p>
						</div>
						<img
							src="/neodlp-library.webp"
							width={500}
							height={500}
							alt="neodlp-library"
							className="absolute -right-4 lg:-right-[30%] -bottom-10 object-contain rounded-2xl"
						/>
					</WobbleCard>
					<WobbleCard containerClassName="col-span-1 min-h-[300px]">
						<h2 className="max-w-80  text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
							Download from thousands of sites
						</h2>
						<p className="mt-4 max-w-[26rem] text-left  text-base/6 text-neutral-200">
							NeoDLP supports downloading from thousands of sites like YouTube,
							Facebook, Instagram, X and many more! Download videos from any
							site on the fly.
						</p>
					</WobbleCard>
					<WobbleCard containerClassName="col-span-1 lg:col-span-3 bg-blue-900 min-h-[500px] lg:min-h-[600px] xl:min-h-[300px]">
						<div className="max-w-sm">
							<h2 className="max-w-sm md:max-w-lg  text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
								Seamlessly Integrate with your favourite browsers
							</h2>
							<p className="mt-4 max-w-[26rem] text-left  text-base/6 text-neutral-200">
								Integrate NeoDLP with your favourite browsers like Chrome,
								Firefox to download videos from any website with ease! Add
								NeoDLP Extension to get started.
							</p>
						</div>
						<img
							src="/neodlp-extension.webp"
							width={500}
							height={500}
							alt="neodlp-extension"
							className="absolute -right-10 md:-right-[30%] lg:-right-[10%] -bottom-10 object-contain rounded-2xl"
						/>
					</WobbleCard>
				</div>
			</div>
		</section>
	);
}
