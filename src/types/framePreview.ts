import { Thumbnail } from "../types";

export type RatioType = '16:9' | '9:16' | '1:1' | '4:5' | '3:5' | '4:3' | '2.39:1';

export interface FrameTransform {
    scale: number;
    offsetX: number;
    offsetY: number;
}

export interface FramePreviewMediaState {
    transforms: {
        [key in RatioType]?: FrameTransform;
    };
    videoTimeSeconds?: number;
    hasCustomFraming?: boolean;
}

export interface FramePreviewMedia {
    id: string;
    filename: string;
    file_path: string;
    preview_path?: string;
    width: number;
    height: number;
    duration_ms: number;
    status: string;
    thumbnails: Thumbnail[];
    thumbnail_src?: string;
    type: 'video' | 'image';
}

export interface FramePreviewState {
    mediaList: FramePreviewMedia[];
    activeMediaId: string | null;
    selectedMediaIds: Set<string>;
    activeRatio: RatioType;
    masterRatio: RatioType | null;
    visibleRatios: RatioType[]; // Max 4
    selectedRatioIds: RatioType[];
    mediaStates: Record<string, FramePreviewMediaState>;
}

export const RATIO_VALUES: Record<RatioType, number> = {
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '1:1': 1 / 1,
    '4:5': 4 / 5,
    '3:5': 3 / 5,
    '4:3': 4 / 3,
    '2.39:1': 2.39 / 1,
};

export const INITIAL_TRANSFORM: FrameTransform = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
};
