# AZAL integration

This integration is deliberately separate from the existing hotel/tour `SupplierAdapter` contract.

## Confirmed upstream endpoints

- `POST /book/api/flights/search/calendar`
- `GET /book/api/flights/search/by-deeplink/offers`
- `POST /book/api/flights/search/histograms`

Requests are executed from a Playwright browser page with `credentials: include`, because direct server-side requests can be rejected by Cloudflare.

## Local API

- `POST /supplier/azal/search`
- `POST /supplier/azal/calendar`
- `POST /supplier/azal/histograms`

No Prisma changes and no Catalog writes are performed.
