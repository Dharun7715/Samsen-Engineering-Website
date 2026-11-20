# Samsen Engineering Contractor

Responsive company website with a Flask admin backend, project portfolio management and SEO routes.

## Frontend
- Premium responsive homepage with Samsen navy, ruby-red and gold brand palette
- Animated hero counters and reveal-on-scroll sections
- Live project gallery populated from the admin dashboard
- Company logo and favicon
- SEO metadata, Open Graph tags, LocalBusiness structured data, `/robots.txt` and `/sitemap.xml`

## Admin dashboard
- Visit `/admin/login`
- Add project title, category, location, description and a JPG/PNG/WEBP photo
- Remove published projects
- Project gallery updates from the database
- Admin credentials are read only from environment variables; no default login is shipped

## Run locally
```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Set these environment variables before running:
- `SECRET_KEY`: long random secret
- `ADMIN_USERNAME`: admin login name
- `ADMIN_PASSWORD_HASH`: Werkzeug password hash (generate with `python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('YOUR_PASSWORD'))"`)
- Optional: `DATA_DIR` (defaults to `./data` locally) and `SITE_URL` (public website URL, no trailing slash)

Run with `python app.py` or `gunicorn app:app`.

## Deploy a separate Render Web Service
The existing Static Site can remain live. Create a second service from the same repository:
1. Render → **New + → Web Service** → select this repository and branch `main`.
2. Runtime: **Python**.
3. Build command: `pip install -r requirements.txt`.
4. Start command: `gunicorn app:app`.
5. Add environment variables: `SECRET_KEY` (generate a long random value), `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `DATA_DIR=/var/data`, and `SITE_URL` (the new Web Service URL).
6. Add a persistent disk mounted at `/var/data` so project records and uploaded photos survive redeploys/restarts. Persistent disks and paid service plans may incur charges; check Render pricing before creating them.
7. Deploy, then open `/admin/login` on the new Web Service URL.

The optional `render-web.yaml` describes this Web Service and its persistent disk. It is separate from the existing `render.yaml` so the current Static Site configuration is not replaced.

## Before launch
- Replace illustrative homepage/gallery photos with actual approved company project photos.
- Confirm the exact business address, phone and email before publishing.
- Set `SITE_URL` to the deployed URL so the sitemap points to the right domain.
- Configure a strong unique admin password and keep its hash private.

No WhatsApp buttons, links or integration are included.
