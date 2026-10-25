# Google Search Console and recovery checklist

## Current production status (checked 2026-10-25)

The apex domain `https://topchamal.ma/` and `https://www.topchamal.ma/` both currently return a domain-expired notice (HTTP 200). The apex and `www` versions of `/robots.txt` and `/sitemap.xml` currently return HTTP 404. Google search results also show the expired-domain notice while retaining older product and collection URLs.

This is a domain/hosting availability blocker, not something a repository change or sitemap submission can repair. Renew/reactivate the domain with its registrar first, then restore the intended hosting and DNS configuration. Do not submit or rely on a sitemap while the public domain is serving the expiration page.

## After the domain is restored

1. Confirm DNS points to the intended production host and deploy the current storefront there.
2. Verify `https://topchamal.ma/` returns the real storefront, not a registrar parking page, and has a canonical URL.
3. Verify `https://topchamal.ma/robots.txt` and `https://topchamal.ma/sitemap.xml` each return HTTP 200. Validate the robots directives and sitemap XML against the deployed build.
4. In [Google Search Console](https://search.google.com/search-console), add or select the Domain property `topchamal.ma`. If it is not verified, add Google's DNS TXT record at the DNS provider and complete verification.
5. Submit `sitemap.xml` in Search Console only after the deployed sitemap is reachable. Inspect the homepage and representative public URLs, then request indexing where appropriate. Submission and indexing are not guaranteed or immediate.
6. Monitor Indexing and URL Inspection for crawl/indexing errors. Google may take time to replace stale expired-domain snippets and cached product results.

## Current sitemap and page coverage

The repository's static sitemap currently contains only the storefront homepage. Admin routes are intentionally excluded. The application does not define standalone public product-detail routes in `src/routes`; storefront products are presented from the homepage, so the current sitemap cannot list individual product pages. Product-level search results and product rich results require stable, crawlable public product URLs with page-specific metadata and valid structured data. Do not add product URLs to the sitemap until those pages actually exist and return indexable content.

## Google verification tag alternative

If DNS verification is unavailable, choose the URL-prefix property in Search Console and use Google's HTML-tag verification value:

```env
VITE_GOOGLE_SITE_VERIFICATION=your-google-verification-token
```

Rebuild and redeploy after setting the value. The token is public verification metadata, not a private credential. Never put account passwords or API secrets in the repository.
