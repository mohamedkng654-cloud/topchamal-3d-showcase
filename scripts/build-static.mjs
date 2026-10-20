import { readFileSync,writeFileSync,mkdirSync,copyFileSync } from 'node:fs';
import {execFileSync} from 'node:child_process';
const escape=(x)=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fallback=`<main><header><h1>Topchamal — أجهزة منزلية لكل لحظة</h1><p>أجهزة منزلية مختارة للمطبخ والبيت. الأسعار بالدرهم المغربي.</p></header><section><h2>المنتجات</h2><p>تظهر تشكيلة المتجر الحالية بعد تحميل الكتالوج المباشر.</p></section></main>`;
writeFileSync('static-app/index.html',readFileSync('static-app/shell.html','utf8').replace('<!--PRODUCT_FALLBACK-->',fallback));
execFileSync('bun',['x','vite','build','--config','static.vite.config.ts'],{stdio:'inherit'});
copyFileSync('public/sitemap.xml','dist-static/sitemap.xml');
copyFileSync('public/robots.txt','dist-static/robots.txt');
copyFileSync('public/favicon.png','dist-static/favicon.png');
