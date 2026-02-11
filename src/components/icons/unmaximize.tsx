export function UnmaximizeIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" className={className}>
            <g fill="currentColor">
                <path d="M3 5v9h9V5zm8 8H4V6h7z" />
                <path fillRule="evenodd" d="M5 5h1V4h7v7h-1v1h2V3H5z" clipRule="evenodd" />
            </g>
        </svg>
    );
}
