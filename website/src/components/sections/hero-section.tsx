import { cn } from "@/lib/utils";
import { ContainerScroll } from "@/components/container-scroll-animation";
import { type LatestRelease } from "@/types/index";

export default function HeroSection({ release }: { release: LatestRelease }) {
	return (
		<section className="flex flex-col w-full min-h-screen relative">
			<div
				className={cn(
					"absolute inset-0",
					"[background-size:20px_20px]",
					"[background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]",
					"dark:[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]",
				)}
			/>
			{/* Radial gradient for the container to give a faded look */}
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black"></div>
			<div className="flex flex-col relative">
				<ContainerScroll
					titleComponent={
						<>
							<h1 className="text-4xl font-semibold text-black dark:text-white">
								The next-gen truly cross-platform <br />
								<span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none">
									Video Downloader
								</span>
							</h1>
						</>
					}
					release={release}
				>
					<img
						src="/neodlp-mockup.webp"
						alt="neodlp-mockup"
						height={744}
						width={1323}
						className="mx-auto rounded-2xl h-full object-left-top"
						draggable={false}
					/>
				</ContainerScroll>
			</div>
		</section>
	);
}
