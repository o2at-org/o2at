import type { APIRoute } from 'astro';
const posts = [
  ['Why propose another optical audio transport?', '/journal/why-o2at/', 'The design question behind an open optical Layer 2 audio proposal.'],
  ['Whose clock controls playback?', '/journal/whose-clock/', 'Receiver-owned conversion timing, finite buffering and source rate control.'],
  ['Why the baseline is 1G SFP.', '/journal/why-1g-sfp/', 'A 1G baseline calculated from occupied Ethernet wire rate.'],
];
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const GET: APIRoute = () => new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>O2AT Journal</title><link>https://o2at.net/journal/</link><description>Engineering notes on the Open Optical Audio Transport proposal.</description><language>en-gb</language>${posts.map(([title, path, desc]) => `<item><title>${esc(title)}</title><link>https://o2at.net${path}</link><guid isPermaLink="true">https://o2at.net${path}</guid><description>${esc(desc)}</description></item>`).join('')}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
