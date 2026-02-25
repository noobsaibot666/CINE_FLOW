import { toJpeg, toPng } from 'html-to-image';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

/**
 * Captures an element and saves it as an image via Tauri's save dialog.
 */
export async function exportElementAsImage(
    element: HTMLElement,
    filename: string,
    format: 'jpeg' | 'png' = 'jpeg'
) {
    try {
        const dataUrl = format === 'jpeg'
            ? await toJpeg(element, { quality: 0.95, backgroundColor: '#ffffff', cacheBust: true, pixelRatio: 2 })
            : await toPng(element, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' });

        // Prompt user for save location
        const filePath = await save({
            filters: [{
                name: 'Image',
                extensions: [format]
            }],
            defaultPath: `${filename}.${format}`
        });

        if (filePath) {
            await invoke("save_image_data_url", { path: filePath, dataUrl });
            return true;
        }
    } catch (error) {
        console.error('Failed to export image:', error);
        throw error;
    }
    return false;
}
