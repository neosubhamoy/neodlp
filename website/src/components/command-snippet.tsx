import React from "react";
import { Terminal } from "lucide-react";
import { CopyButton } from "@/components/copy-button";

export const CommandSnippet = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => {
	return (
		<div className="flex flex-col rounded-lg border border-border overflow-hidden w-[20rem] md:w-[30rem]">
			<div className="flex items-center justify-between pl-4 pr-2 py-1 gap-2 bg-muted">
				<div className="flex items-center gap-2">
					<Terminal className="size-4" />
					<span className="text-xs text-muted-foreground">{title}</span>
				</div>
				<CopyButton
					text={children?.toString() ?? ""}
					variant="ghost"
					size="icon-xs"
				/>
			</div>
			<code className="flex px-4 py-2 overflow-x-scroll text-nowrap">
				<p className="">{children}</p>
			</code>
		</div>
	);
};
