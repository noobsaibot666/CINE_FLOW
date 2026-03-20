import { useState, useCallback, useMemo } from 'react';
import { FramePreviewMedia, FramePreviewState, RatioType, FrameTransform, INITIAL_TRANSFORM, FramePreviewMediaState } from '../../types/framePreview';

function buildDefaultMediaState(): FramePreviewMediaState {
    return {
        transforms: {
            '16:9': { ...INITIAL_TRANSFORM }
        },
        videoTimeSeconds: 0
    };
}

function addOrReplaceVisibleRatio(visibleRatios: RatioType[], nextRatio: RatioType, activeRatio: RatioType): RatioType[] {
    if (visibleRatios.includes(nextRatio)) {
        return visibleRatios;
    }

    if (visibleRatios.length < 3) {
        return [...visibleRatios, nextRatio];
    }

    return visibleRatios.map((ratio) => (ratio === activeRatio ? nextRatio : ratio));
}

export function useFramePreview() {
    const [state, setState] = useState<FramePreviewState>({
        mediaList: [],
        activeMediaId: null,
        selectedMediaIds: new Set(),
        activeRatio: '16:9',
        masterRatio: '16:9',
        visibleRatios: ['16:9'],
        selectedRatioIds: ['16:9'],
        mediaStates: {}
    });

    const activeMedia = useMemo(() => 
        state.mediaList.find(m => m.id === state.activeMediaId) || null
    , [state.mediaList, state.activeMediaId]);

    const setMediaList = useCallback((media: FramePreviewMedia[]) => {
        setState(prev => {
            const nextMediaStates = { ...prev.mediaStates };

            media.forEach(item => {
                if (!nextMediaStates[item.id]) {
                    nextMediaStates[item.id] = buildDefaultMediaState();
                }
            });

            Object.keys(nextMediaStates).forEach(id => {
                if (!media.some(item => item.id === id)) {
                    delete nextMediaStates[id];
                }
            });

            return {
                ...prev,
                mediaList: media,
                activeMediaId: prev.activeMediaId || (media.length > 0 ? media[0].id : null),
                mediaStates: nextMediaStates
            };
        });
    }, []);

    const setActiveMedia = useCallback((id: string) => {
        setState(prev => ({ ...prev, activeMediaId: id }));
    }, []);

    const toggleMediaSelection = useCallback((id: string, multi: boolean) => {
        setState(prev => {
            const next = new Set(prev.selectedMediaIds);
            if (multi) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            } else {
                next.clear();
                next.add(id);
            }
            return { ...prev, selectedMediaIds: next };
        });
    }, []);

    const updateTransform = useCallback((mediaId: string, ratio: RatioType, updates: Partial<FrameTransform>) => {
        setState(prev => {
            const mediaState = prev.mediaStates[mediaId] || buildDefaultMediaState();
            const current = mediaState.transforms[ratio] || { ...INITIAL_TRANSFORM };
            return {
                ...prev,
                mediaStates: {
                    ...prev.mediaStates,
                    [mediaId]: {
                        ...mediaState,
                        transforms: {
                            ...mediaState.transforms,
                            [ratio]: { ...current, ...updates }
                        }
                    }
                }
            };
        });
    }, []);

    const setVideoTime = useCallback((mediaId: string, timeSeconds: number) => {
        setState(prev => {
            const mediaState = prev.mediaStates[mediaId] || buildDefaultMediaState();
            return {
                ...prev,
                mediaStates: {
                    ...prev.mediaStates,
                    [mediaId]: {
                        ...mediaState,
                        videoTimeSeconds: timeSeconds
                    }
                }
            };
        });
    }, []);

    const toggleRatio = useCallback((ratio: RatioType) => {
        setState(prev => {
            const isVisible = prev.visibleRatios.includes(ratio);
            let nextVisible = [...prev.visibleRatios];
            
            if (isVisible) {
                nextVisible = nextVisible.filter(r => r !== ratio);
            } else {
                if (nextVisible.length < 3) {
                    nextVisible.push(ratio);
                }
            }

            const nextActive = nextVisible.length === 0
                ? prev.activeRatio
                : (nextVisible.includes(prev.activeRatio) ? prev.activeRatio : nextVisible[0]);
            const nextSelected = prev.selectedRatioIds.filter(item => nextVisible.includes(item));

            return {
                ...prev,
                visibleRatios: nextVisible,
                activeRatio: nextActive,
                masterRatio: nextVisible.length === 0
                    ? null
                    : (prev.masterRatio && nextVisible.includes(prev.masterRatio) ? prev.masterRatio : nextVisible[0]),
                selectedRatioIds: nextVisible.length === 0 ? [] : (nextSelected.length > 0 ? nextSelected : [nextActive])
            };
        });
    }, []);

    const setActiveRatio = useCallback((ratio: RatioType) => {
        setState(prev => ({
            ...prev,
            activeRatio: ratio,
            selectedRatioIds: prev.selectedRatioIds.includes(ratio) ? prev.selectedRatioIds : [ratio]
        }));
    }, []);

    const clickRatio = useCallback((ratio: RatioType, multi: boolean) => {
        setState(prev => {
            const isVisible = prev.visibleRatios.includes(ratio);
            const visible = multi
                ? addOrReplaceVisibleRatio(prev.visibleRatios, ratio, prev.activeRatio)
                : prev.visibleRatios;
            const selected = [...prev.selectedRatioIds];

            if (multi) {
                const selectedSet = new Set(selected);
                if (selectedSet.has(ratio) && selectedSet.size > 1) {
                    selectedSet.delete(ratio);
                } else {
                    selectedSet.add(ratio);
                }

                const nextSelected = Array.from(selectedSet).filter(item => visible.includes(item));
                const nextActive = prev.visibleRatios.includes(ratio) || visible.includes(ratio) ? ratio : prev.activeRatio;

                return {
                    ...prev,
                    activeRatio: nextActive,
                    visibleRatios: Array.from(new Set(visible)),
                    selectedRatioIds: nextSelected.length > 0 ? nextSelected : [nextActive]
                };
            }

            if (prev.visibleRatios.length === 0) {
                return {
                    ...prev,
                    activeRatio: ratio,
                    masterRatio: ratio,
                    visibleRatios: [ratio],
                    selectedRatioIds: [ratio]
                };
            }

            const nextVisible = isVisible
                ? visible
                : prev.visibleRatios.map((item) => (item === prev.activeRatio ? ratio : item));
            const nextActive = ratio;

            return {
                ...prev,
                activeRatio: nextActive,
                visibleRatios: Array.from(new Set(nextVisible)),
                selectedRatioIds: [nextActive]
            };
        });
    }, []);

    const resetTransform = useCallback((mediaId: string, ratio: RatioType) => {
        updateTransform(mediaId, ratio, INITIAL_TRANSFORM);
    }, [updateTransform]);

    const setMasterRatio = useCallback((ratio: RatioType | null) => {
        setState(prev => {
            if (ratio === null) {
                return {
                    ...prev,
                    masterRatio: null
                };
            }

            if (!prev.visibleRatios.includes(ratio)) {
                return prev;
            }

            return {
                ...prev,
                masterRatio: prev.masterRatio === ratio ? null : ratio
            };
        });
    }, []);

    return {
        state,
        activeMedia,
        setMediaList,
        setActiveMedia,
        toggleMediaSelection,
        updateTransform,
        setVideoTime,
        toggleRatio,
        setActiveRatio,
        setMasterRatio,
        clickRatio,
        resetTransform
    };
}
