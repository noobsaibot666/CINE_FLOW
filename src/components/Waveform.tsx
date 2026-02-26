import React from 'react';

interface WaveformProps {
    envelope: number[]; // Array of 0-255 values
    color?: string;
    height?: number;
    width?: string;
    onPlayToggle?: () => void;
    isPlaying?: boolean;
    progress?: number; // 0 to 100
}

export const Waveform: React.FC<WaveformProps> = ({
    envelope,
    color = "var(--color-accent)",
    height = 36,
    width = "100%",
    onPlayToggle,
    isPlaying = false,
    progress = 0
}) => {
    const id = React.useId();
    const gradientId = `waveform-gradient-${id.replace(/:/g, '')}`;

    if (!envelope || envelope.length === 0) return null;

    // Calculate points for the SVG polyline/path
    const points = envelope.map((val, i) => {
        const x = (i / (envelope.length - 1)) * 100;
        const y = 100 - (val / 255) * 100; // Invert and normalize to 0-100
        return `${x},${y}`;
    }).join(' ');

    const fillPath = `0,100 ${points} 100,100`;

    return (
        <div className="waveform-outer">
            <div className="waveform-container" style={{ width, height, position: 'relative' }}>
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{ width: '100%', height: '100%', display: 'block' }}
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
                        </linearGradient>
                    </defs>

                    {/* Fill */}
                    <polyline
                        points={fillPath}
                        fill={`url(#${gradientId})`}
                        stroke="none"
                    />

                    {/* Stroke */}
                    <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    {/* Playhead */}
                    {progress > 0 && (
                        <>
                            <line
                                x1={progress}
                                y1="0"
                                x2={progress}
                                y2="100"
                                stroke="var(--color-accent-blue, #22d3ee)"
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                            />
                            {/* Progress Overlay (darken played part) */}
                            <rect
                                x="0"
                                y="0"
                                width={progress}
                                height="100"
                                fill="var(--color-accent-blue, #22d3ee)"
                                fillOpacity="0.15"
                                pointerEvents="none"
                            />
                        </>
                    )}
                </svg>
            </div>

            {onPlayToggle && (
                <button
                    className={`waveform-play-btn ${isPlaying ? 'playing' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlayToggle();
                    }}
                    title={isPlaying ? "Pause audio" : "Play audio preview"}
                >
                    {isPlaying ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    )}
                </button>
            )}
        </div>
    );
};
