import { h } from '../dom';

export function creditFooter(): HTMLElement {
  return h(
    'footer',
    {},
    h(
      'a',
      { href: 'https://0xhorizon.xyz', rel: 'noopener', target: '_blank', class: 'credit' },
      'Made with ',
      h('span', { class: 'heart', 'aria-label': 'love' }, '♥'),
      ' by 0xhorizon.xyz',
    ),
  );
}

/**
 * Open the phone's share sheet, or copy the link where sharing isn't available.
 * Returns what happened so the button can say so.
 */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export const SHARE_RESULT_TEXT = {
  shared: 'Share',
  copied: 'Link copied',
  failed: "Couldn't share",
} as const;
