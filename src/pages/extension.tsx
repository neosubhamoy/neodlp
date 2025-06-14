import { SlidingButton } from "@/components/custom/slidingButton";
import Heading from "@/components/heading";
import { ArrowRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function ExtensionPage() {
    const { toast } = useToast();
    const openLink = async (url: string, app: string | null) => {
        try {
            await invoke('open_file_with_app', { filePath: url, appName: app }).then(() => {
                toast({
                    title: 'Opening Link',
                    description: `Opening link with ${app ? app : 'default app'}.`,
                })
            });
        } catch (e) {
            console.error(e);
            toast({
                title: 'Failed to open link',
                description: 'An error occurred while trying to open the link.',
                variant: "destructive"
            })
        }
    }

    return (
        <div className="container mx-auto p-4 space-y-4">
            <Heading title="Extension" description="Integrate NeoDLP with your favourite browser" />
            <div className="flex items-center gap-4">
                <SlidingButton
                    slidingContent={
                        <div className="flex items-center justify-center gap-2 text-white dark:text-black">
                            <ArrowRight className="size-4" />
                            <span>Get Now</span>
                        </div>
                    }
                    onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'chrome')}
                    >
                    <span className="font-semibold flex items-center gap-2">
                        <svg className="size-4 fill-white dark:fill-black" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                            <path d="M0 256C0 209.4 12.5 165.6 34.3 127.1L144.1 318.3C166 357.5 207.9 384 256 384C270.3 384 283.1 381.7 296.8 377.4L220.5 509.6C95.9 492.3 0 385.3 0 256zM365.1 321.6C377.4 302.4 384 279.1 384 256C384 217.8 367.2 183.5 340.7 160H493.4C505.4 189.6 512 222.1 512 256C512 397.4 397.4 511.1 256 512L365.1 321.6zM477.8 128H256C193.1 128 142.3 172.1 130.5 230.7L54.2 98.5C101 38.5 174 0 256 0C350.8 0 433.5 51.5 477.8 128V128zM168 256C168 207.4 207.4 168 256 168C304.6 168 344 207.4 344 256C344 304.6 304.6 344 256 344C207.4 344 168 304.6 168 256z"/>
                        </svg>
                        Get Chrome Extension
                    </span>
                    <span className="text-xs">from Chrome Web Store</span>
                </SlidingButton>
                <SlidingButton
                    slidingContent={
                        <div className="flex items-center justify-center gap-2 text-white dark:text-black">
                            <ArrowRight className="size-4" />
                            <span>Get Now</span>
                        </div>
                    }
                    onClick={() => openLink('https://addons.mozilla.org/en-US/firefox/addon/neo-downloader-plus', 'firefox')}
                    >
                    <span className="font-semibold flex items-center gap-2">
                        <svg className="size-4 fill-white dark:fill-black" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                            <path d="M130.2 127.5C130.4 127.6 130.3 127.6 130.2 127.5V127.5zM481.6 172.9C471 147.4 449.6 119.9 432.7 111.2C446.4 138.1 454.4 165 457.4 185.2C457.4 185.3 457.4 185.4 457.5 185.6C429.9 116.8 383.1 89.1 344.9 28.7C329.9 5.1 334 3.5 331.8 4.1L331.7 4.2C285 30.1 256.4 82.5 249.1 126.9C232.5 127.8 216.2 131.9 201.2 139C199.8 139.6 198.7 140.7 198.1 142C197.4 143.4 197.2 144.9 197.5 146.3C197.7 147.2 198.1 148 198.6 148.6C199.1 149.3 199.8 149.9 200.5 150.3C201.3 150.7 202.1 151 203 151.1C203.8 151.1 204.7 151 205.5 150.8L206 150.6C221.5 143.3 238.4 139.4 255.5 139.2C318.4 138.7 352.7 183.3 363.2 201.5C350.2 192.4 326.8 183.3 304.3 187.2C392.1 231.1 368.5 381.8 247 376.4C187.5 373.8 149.9 325.5 146.4 285.6C146.4 285.6 157.7 243.7 227 243.7C234.5 243.7 256 222.8 256.4 216.7C256.3 214.7 213.8 197.8 197.3 181.5C188.4 172.8 184.2 168.6 180.5 165.5C178.5 163.8 176.4 162.2 174.2 160.7C168.6 141.2 168.4 120.6 173.5 101.1C148.5 112.5 129 130.5 114.8 146.4H114.7C105 134.2 105.7 93.8 106.3 85.3C106.1 84.8 99 89 98.1 89.7C89.5 95.7 81.6 102.6 74.3 110.1C58 126.7 30.1 160.2 18.8 211.3C14.2 231.7 12 255.7 12 263.6C12 398.3 121.2 507.5 255.9 507.5C376.6 507.5 478.9 420.3 496.4 304.9C507.9 228.2 481.6 173.8 481.6 172.9z"/>
                        </svg>
                        Get Firefox Extension
                    </span>
                    <span className="text-xs">from Mozilla Addons Store</span>
                </SlidingButton>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'msedge')}>Edge</Button>
                <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'opera')}>Opera</Button>
                <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'brave')}>Brave</Button>
                <Button variant="outline" onClick={() => openLink('https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf', 'arc')}>Arc</Button>
                <Button variant="outline" onClick={() => openLink('https://addons.mozilla.org/en-US/firefox/addon/neo-downloader-plus', 'zen')}>Zen</Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">* These links opens with coresponding browsers only. Make sure the browser is installed befor clicking the link</p>
        </div>
    )
}