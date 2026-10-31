import { Card } from "@/components/ui/card";
import { NeoDlpIcon } from "@/components/icons";

export default function Header() {
	const manifest = browser.runtime.getManifest();

	return (
		<Card className="p-4">
			<div className="flex items-center justify-center space-x-4">
				<NeoDlpIcon className="w-8 h-8 rounded-lg" />
				<div className="flex flex-col items-start">
					<h1 className="text-sm font-semibold">{manifest.name}</h1>
					<p className="text-xs">Extension - v{manifest.version}</p>
				</div>
			</div>
		</Card>
	);
}
