import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = "_static-entry.html";
const fallback = `<main><header><h1>Topchamal — أجهزة منزلية لكل لحظة</h1><p>أجهزة منزلية مختارة للمطبخ والبيت. الأسعار بالدرهم المغربي.</p></header><section><h2>المنتجات</h2><p>تظهر تشكيلة المتجر الحالية بعد تحميل الكتالوج المباشر.</p></section></main>`;

try {
  writeFileSync(
    entry,
    readFileSync("static-app/shell.html", "utf8").replace("<!--PRODUCT_FALLBACK-->", fallback),
  );
  const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  execFileSync(process.execPath, [viteCli, "build", "--config", "static.vite.config.ts"], {
    stdio: "inherit",
  });
  renameSync("dist-static/_static-entry.html", "dist-static/index.html");
  copyFileSync("public/sitemap.xml", "dist-static/sitemap.xml");
  copyFileSync("public/robots.txt", "dist-static/robots.txt");
  copyFileSync("public/favicon.png", "dist-static/favicon.png");
} finally {
  if (existsSync(entry)) unlinkSync(entry);
}
