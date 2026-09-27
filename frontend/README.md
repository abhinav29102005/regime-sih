# MeghDrishti frontend

## Local development

Use Node.js 20.9 or newer:

```bash
npm ci
npm run dev
```

The frontend defaults to the local API at `http://localhost:8000/api/v1`.
Start the backend separately from the repository root:

```bash
python -m pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

## Production deployment

Before building, set `NEXT_PUBLIC_API_URL` to the complete public API base URL,
including `/api/v1`. For example:

```text
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

The variable is embedded in the frontend at build time; changing it only in the
running service will not update an already-built frontend. The build intentionally
fails if this value is missing in production, rather than silently sending
requests to each visitor's localhost.

### Cloudflare Pages

The frontend uses client-side API calls and can be deployed as a static export.
In the Cloudflare Pages project settings, configure:

- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Build output directory:** `out`
- **Environment variables:** `CLOUDFLARE_PAGES=1` and
  `NEXT_PUBLIC_API_URL=https://<your-api-host>/api/v1`

Set both variables for production builds (and preview builds if those should use
a separate API). `CLOUDFLARE_PAGES=1` enables Next.js static export only for
Cloudflare Pages; ordinary local and Node.js builds retain regular Next.js
server output.

### Local or Node.js hosting

Without `CLOUDFLARE_PAGES=1`, build and run using the package scripts:

```bash
npm ci
npm run build
npm run start
```

The API service should install `requirements.txt` and bind to the platform's
assigned port and all interfaces, for example:

```bash
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

Configure `TURSO_URL` and `TURSO_TOKEN` on the API service when using Turso for
persistent production storage. Without them, the API uses a local SQLite file,
which may not persist across deployments on ephemeral hosting. The API's CORS
allowlist defaults to the existing production and localhost origins. Set
`CORS_ORIGINS` on the API service to a comma-separated list of exact frontend
origins when deploying to a different domain.
