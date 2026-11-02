import { GlowingEffect } from "@/components/glowing-effect";
import { Globe, HeartHandshake, Settings, Sparkles, Video } from "lucide-react";

interface GridItemProps {
	area: string;
	icon: React.ReactNode;
	title: string;
	description: React.ReactNode;
}

const GridItem = ({ area, icon, title, description }: GridItemProps) => {
	return (
		<li className={`min-h-[14rem] list-none ${area}`}>
			<div className="relative h-full rounded-2xl border p-2 md:rounded-3xl md:p-3">
				<GlowingEffect
					spread={40}
					glow={true}
					disabled={false}
					proximity={64}
					inactiveZone={0.01}
				/>
				<div className="border-0.75 relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl p-6 md:p-6 dark:shadow-[0px_0px_27px_0px_#2D2D2D]">
					<div className="relative flex flex-1 flex-col justify-between gap-3">
						<div className="w-fit rounded-lg border border-gray-600 p-2">
							{icon}
						</div>
						<div className="space-y-3">
							<h3 className="-tracking-4 pt-0.5 font-sans text-xl/[1.375rem] font-semibold text-balance text-black md:text-2xl/[1.875rem] dark:text-white">
								{title}
							</h3>
							<h2 className="font-sans text-sm/[1.125rem] text-black md:text-base/[1.375rem] dark:text-neutral-400 [&_b]:md:font-semibold [&_strong]:md:font-semibold">
								{description}
							</h2>
						</div>
					</div>
				</div>
			</div>
		</li>
	);
};

export default function FeaturesSection() {
	return (
		<section className="flex flex-col w-full mb-26" id="features">
			<div className="flex flex-col relative items-center">
				<div className="flex flex-col items-center justify-center gap-2 pt-40 pb-26">
					<h3 className="text-3xl lg:text-4xl font-bold">Features</h3>
					<p className="text-sm lg:text-lg font-semibold text-muted-foreground">
						Take a look on NeoDLP's features and offerings
					</p>
				</div>
				<ul className="grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-12 md:grid-rows-3 lg:gap-4 xl:max-h-[34rem] xl:grid-rows-2 px-4 max-w-7xl">
					<GridItem
						area="md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]"
						icon={
							<Video className="h-4 w-4 text-black dark:text-neutral-400" />
						}
						title="Video and Playlist Download"
						description="Download videos and playlists from mostly any site exists in the planet."
					/>
					<GridItem
						area="md:[grid-area:1/7/2/13] xl:[grid-area:2/1/3/5]"
						icon={
							<Settings className="h-4 w-4 text-black dark:text-neutral-400" />
						}
						title="Highly Customizable"
						description="Customize NeoDLP to your liking with a wide range of options and settings."
					/>
					<GridItem
						area="md:[grid-area:2/1/3/7] xl:[grid-area:1/5/3/8]"
						icon={
							<HeartHandshake className="h-4 w-4 text-black dark:text-neutral-400" />
						}
						title="Fully Free and Open Sourced"
						description="NeoDLP is built on top of 100% Free and Open Source software components. No strings attached."
					/>
					<GridItem
						area="md:[grid-area:2/7/3/13] xl:[grid-area:1/8/2/13]"
						icon={
							<Sparkles className="h-4 w-4 text-black dark:text-neutral-400" />
						}
						title="Lightweight, Fast and Flexible"
						description="NeoDLP is built with performance in mind. It's lightweight, fast and works on any platform. Built with Tauri."
					/>
					<GridItem
						area="md:[grid-area:3/1/4/13] xl:[grid-area:2/8/3/13]"
						icon={
							<Globe className="h-4 w-4 text-black dark:text-neutral-400" />
						}
						title="Browser Integration"
						description="Integrate NeoDLP with your favourite browsers like Chrome, Firefox to download videos from any website with ease."
					/>
				</ul>
			</div>
		</section>
	);
}
