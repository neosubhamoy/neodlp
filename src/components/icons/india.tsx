export function IndianFlagLogo({ className }: { className?: string }) {
    return (
        <svg width="1024" height="1024" viewBox="-45 -30 90 60" fill="#07038D" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" className={className}>
            <path fill="#FFF" d="m-45-30h90v60h-90z"/>
            <path fill="#FF6820" d="m-45-30h90v20h-90z"/>
            <path fill="#046A38" d="m-45 10h90v20h-90z"/>
            <circle r="9.25"/>
            <circle fill="#FFF" r="8"/>
            <circle r="1.6"/>
            <g id="d">
                <g id="c">
                    <g id="b">
                        <g id="a">
                            <path d="m0-8 .3 4.81409L0-.80235-.3-3.18591z"/>
                            <circle transform="rotate(7.5)" r="0.35" cy="-8"/>
                        </g>
                        <use xlinkHref="#a" transform="scale(-1)"/>
                    </g>
                    <use xlinkHref="#b" transform="rotate(15)"/>
                </g>
                <use xlinkHref="#c" transform="rotate(30)"/>
            </g>
            <use xlinkHref="#d" transform="rotate(60)"/>
            <use xlinkHref="#d" transform="rotate(120)"/>
        </svg>
    );
}
