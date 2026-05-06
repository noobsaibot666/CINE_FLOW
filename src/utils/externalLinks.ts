import { openUrl } from '@tauri-apps/plugin-opener';

export const PURCHASE_URL = 'https://alan-design.com/#/store';
export const SUPPORT_URL = 'https://alan-design.com/#/store/support/app-01';

export async function openExternalUrl(url: string) {
  try {
    await openUrl(url);
  } catch (error) {
    console.error('Failed to open external URL via Tauri opener:', error);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
