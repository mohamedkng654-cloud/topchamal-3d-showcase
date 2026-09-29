import { readFileSync,writeFileSync,mkdirSync,copyFileSync } from 'node:fs';
import {execFileSync} from 'node:child_process';
import catalog from '../src/data/products.json' with { type: 'json' };
const escape=(x)=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fallback=`<main><header><h1>Topchamal — أجهزة منزلية لكل لحظة</h1><p>أجهزة منزلية مختارة للمطبخ والبيت. الأسعار بالدرهم المغربي.</p></header><section><h2>المنتجات</h2>${catalog.products.map(p=>`<article><h3>${escape(p.name)}</h3><img loading="lazy" width="240" height="240" src="${escape(p.image)}" alt="${escape(p.name)}"/><p>${escape(p.price)} د.م</p></article>`).join('')}</section></main>`;
writeFileSync('static-app/index.html',readFileSync('static-app/shell.html','utf8').replace('<!--PRODUCT_FALLBACK-->',fallback));
execFileSync('bun',['x','vite','build','--config','static.vite.config.ts'],{stdio:'inherit'});
copyFileSync('public/sitemap.xml','dist-static/sitemap.xml');
copyFileSync('public/robots.txt','dist-static/robots.txt');
