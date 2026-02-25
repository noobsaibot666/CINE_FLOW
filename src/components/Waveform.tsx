import React from 'react';

interface WaveformProps {
    envelope: number[]; // Array of 0-255 values
    color?: string;
    height?: number;
    width?: string;
}

export const Waveform: React.FC<WaveformProps> = ({
    envelope,
    color = "var(--color-accent)",
    height = 32,
    width = "100%"
}) => {
    const id = React.useId();
    const gradientId = `waveform-gradient-${id.replace(/:/g, '')}`;

    if (!envelope || envelope.length === 0) return null;

    // Calculate points for the SVG polyline/path
    // Using a path for a smooth bottom-aligned sparkline
    const points = envelope.map((val, i) => {
        const x = (i / (envelope.length - 1)) * 100;
        const y = 100 - (val / 255) * 100; // Invert and normalize to 0-100
        return `${x},${y}`;
    }).join(' ');

    // Create a fill path by adding corners to the points
    const fillPath = `0,100 ${points} 100,100`;

    return (
        <div className="waveform-container" style={{ width, height, position: 'relative' }}>
            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ width: '100%', height: '100%', display: 'block' }}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="1.0" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.2" />
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
                    strokeWidth="2.0"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </svg>

        </div>
    );
};
