import type { APIRoute } from 'astro';
const pages = [
  '/', '/how-it-works/', '/clocking/', '/specification/', '/specification/full/', '/explore/',
  '/build-and-test/', '/contribute/', '/journal/', '/journal/why-o2at/',
  '/journal/whose-clock/', '/journal/why-1g-sfp/', '/about/', '/privacy/', '/terms/',
];
export const GET: APIRoute = () => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(path => `<url><loc>https://o2at.net${path}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
