import { toJpeg, toPng } from 'html-to-image';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { jsPDF } from 'jspdf';

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

/**
 * Captures multiple elements (pages) and saves them as a multi-page PDF.
 */
export async function exportElementsAsPdf(
    elements: HTMLElement[],
    filename: string
) {
    try {
        if (elements.length === 0) return false;

        // Prompt user for save location
        const filePath = await save({
            filters: [{
                name: 'PDF Document',
                extensions: ['pdf']
            }],
            defaultPath: `${filename}.pdf`
        });

        if (!filePath) return false;

        // A4 Landscape in mm: 297 x 210
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];

            // Capture page as image
            const dataUrl = await toJpeg(el, {
                quality: 0.95,
                backgroundColor: '#ffffff',
                cacheBust: true,
                pixelRatio: 2
            });

            if (i > 0) pdf.addPage();

            // Add image to PDF - match A4 landscape dimensions
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210);
        }

        // Generate PDF as blob or data url
        const pdfDataUri = pdf.output('datauristring');

        // Save via Tauri
        await invoke("save_image_data_url", { path: filePath, dataUrl: pdfDataUri });
        return true;
    } catch (error) {
        console.error('Failed to export PDF:', error);
        throw error;
    }
}
