import { InfiniteMovingCards } from "@/components/infinite-moving-cards";

export default function TestimonialSection() {
	const testimonials = [
		{
			quote: "This is brilliant. No fuss and works.",
			name: "NBCGLX",
			title: "Reddit User",
		},
		{
			quote:
				"JESUS CHRIST, MAN!! THIS IS GOOD! The UI is straight-up better than Stacher and Nickvision Parabolic. It can easily embed subtitles and thumbnails, that’s seriously impressive work!",
			name: "JustAnAlias404",
			title: "Reddit User",
		},
		{
			quote:
				"Just tried a video on YouTube that other sites wouldn't let me get (because it's over 2GB) and your app worked perfectly! I appreciate your hard work and making it available to us.",
			name: "Stingrea51",
			title: "Reddit User",
		},
		{
			quote:
				"holy sh*t ur app was amazing, had no clue how to use yt-dlp but this worked perfectly in 30 sec",
			name: "RiickyBird",
			title: "Reddit User",
		},
		{
			quote:
				"I've been really struggling with getting yt-dlp to work, and your app is working flawlessly on Linux Pop_OS. Thank you for your work!!",
			name: "Kestrel991",
			title: "Reddit User",
		},
	];

	return (
		<section className="flex flex-col w-full mb-16" id="testimonials">
			<div className="flex flex-col items-center justify-center gap-2 pt-40 pb-16">
				<h3 className="text-3xl lg:text-4xl font-bold">Testimonials</h3>
				<p className="text-sm lg:text-lg font-semibold text-muted-foreground">
					Let's see, what real users are saying!
				</p>
			</div>
			<div className="h-[20rem] rounded-md flex flex-col antialiased bg-white dark:bg-black dark:bg-grid-white/[0.05] items-center justify-center relative overflow-hidden">
				<InfiniteMovingCards
					items={testimonials}
					direction="right"
					speed="slow"
				/>
			</div>
		</section>
	);
}
