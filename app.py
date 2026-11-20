import os, sqlite3, uuid
from pathlib import Path
from functools import wraps
from datetime import datetime, timezone
from flask import Flask, request, redirect, url_for, session, jsonify, send_from_directory, render_template_string, abort
from werkzeug.security import check_password_hash
from werkzeug.utils import secure_filename
from flask_wtf.csrf import CSRFProtect, generate_csrf

BASE = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", "/var/data"))
if not DATA_DIR.exists():
    DATA_DIR = BASE / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = os.environ.get("DATABASE_PATH", str(DATA_DIR / "samsen.sqlite3"))
SITE_URL = os.environ.get("SITE_URL", "").rstrip("/")
ALLOWED = {"png", "jpg", "jpeg", "webp"}

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "local-development-only-change-me")
app.config.update(
    MAX_CONTENT_LENGTH=5 * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("RENDER", "") == "true",
)
csrf = CSRFProtect(app)

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Construction',
            location TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
            image TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
        )""")
init_db()

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            if request.path.startswith("/api/"):
                return jsonify(error="Authentication required"), 401
            return redirect(url_for("admin_login"))
        return fn(*args, **kwargs)
    return wrapper

@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

@app.get("/")
def home():
    return send_from_directory(BASE, "index.html")

@app.get("/styles.css")
def styles():
    return send_from_directory(BASE, "styles.css")

@app.get("/script.js")
def script():
    return send_from_directory(BASE, "script.js")

@app.get("/logo.svg")
def logo():
    return send_from_directory(BASE, "logo.svg")

@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.get("/api/projects")
def public_projects():
    with db() as conn:
        rows = conn.execute("SELECT id,title,category,location,description,image FROM projects ORDER BY id DESC").fetchall()
    return jsonify([dict(row) for row in rows])

@app.get("/admin/login")
def admin_login():
    return render_template_string(LOGIN_PAGE, csrf_token=generate_csrf(), error="")

@app.post("/admin/login")
def admin_login_post():
    username = os.environ.get("ADMIN_USERNAME", "")
    password_hash = os.environ.get("ADMIN_PASSWORD_HASH", "")
    submitted_user = request.form.get("username", "")
    submitted_password = request.form.get("password", "")
    valid = bool(username and password_hash and submitted_user == username and check_password_hash(password_hash, submitted_password))
    if not valid:
        return render_template_string(LOGIN_PAGE, csrf_token=generate_csrf(), error="Invalid username or password."), 401
    session.clear()
    session["admin"] = True
    session.permanent = True
    return redirect(url_for("admin_dashboard"))

@app.post("/admin/logout")
@admin_required
def admin_logout():
    session.clear()
    return redirect(url_for("home"))

@app.get("/admin")
@admin_required
def admin_dashboard():
    with db() as conn:
        projects = conn.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
    return render_template_string(ADMIN_PAGE, projects=projects, csrf_token=generate_csrf())

@app.post("/admin/projects")
@admin_required
def add_project():
    title = request.form.get("title", "").strip()
    category = request.form.get("category", "Construction").strip()[:80]
    location = request.form.get("location", "").strip()[:160]
    description = request.form.get("description", "").strip()[:1200]
    file = request.files.get("image")
    if not title or not file or not file.filename:
        abort(400, "Project title and image are required.")
    ext = secure_filename(file.filename).rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED:
        abort(400, "Use JPG, PNG or WEBP images only.")
    filename = f"{uuid.uuid4().hex}.{ext}"
    file.save(UPLOAD_DIR / filename)
    with db() as conn:
        conn.execute("INSERT INTO projects(title,category,location,description,image,created_at) VALUES(?,?,?,?,?,?)",
                     (title[:140], category, location, description, f"/uploads/{filename}", datetime.now(timezone.utc).isoformat()))
    return redirect(url_for("admin_dashboard"))

@app.post("/admin/projects/<int:project_id>/delete")
@admin_required
def delete_project(project_id):
    with db() as conn:
        row = conn.execute("SELECT image FROM projects WHERE id=?", (project_id,)).fetchone()
        if row:
            if row["image"].startswith("/uploads/"):
                (UPLOAD_DIR / Path(row["image"]).name).unlink(missing_ok=True)
            conn.execute("DELETE FROM projects WHERE id=?", (project_id,))
    return redirect(url_for("admin_dashboard"))

@app.get("/robots.txt")
def robots():
    sitemap = f"{SITE_URL}/sitemap.xml" if SITE_URL else "/sitemap.xml"
    return f"User-agent: *\\nAllow: /\\nDisallow: /admin\\nDisallow: /api/\\nSitemap: {sitemap}\\n", 200, {"Content-Type":"text/plain; charset=utf-8"}

@app.get("/sitemap.xml")
def sitemap():
    base = SITE_URL or request.url_root.rstrip("/")
    urls = ["", "#about", "#services", "#projects", "#contact"]
    xml = '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    xml += "".join(f"<url><loc>{base}/{part}</loc></url>" for part in urls)
    xml += "</urlset>"
    return xml, 200, {"Content-Type":"application/xml; charset=utf-8"}

@app.errorhandler(413)
def too_large(_):
    return "Image is too large. Maximum upload size is 5 MB.", 413

LOGIN_PAGE = """
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin Login | Samsen</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071b45;color:#14213b;font:15px Arial}.card{width:min(420px,92vw);background:white;padding:38px;border-top:5px solid #a80b3c;box-shadow:0 20px 60px #0004}.logo{font-weight:800;letter-spacing:3px;color:#08245b}.logo small{display:block;font-size:10px;letter-spacing:2px;margin-top:5px}.muted{color:#68748a;line-height:1.6}label{display:block;font-size:12px;font-weight:bold;margin:18px 0 7px}input{width:100%;padding:13px;border:1px solid #ccd2dc;font-size:15px}button{width:100%;padding:14px;margin-top:22px;border:0;background:#a80b3c;color:white;font-weight:bold;cursor:pointer}.error{color:#a80b3c;font-size:13px}</style></head><body><main class="card"><div class="logo">SAMSEN<small>ENGINEERING CONTRACTOR</small></div><h1>Admin sign in</h1><p class="muted">Manage project photos and website portfolio.</p>{% if error %}<p class="error">{{error}}</p>{% endif %}<form method="post"><input type="hidden" name="csrf_token" value="{{csrf_token}}"><label>USERNAME</label><input name="username" required autocomplete="username"><label>PASSWORD</label><input type="password" name="password" required autocomplete="current-password"><button>Sign in securely</button></form></main></body></html>
"""

ADMIN_PAGE = """
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin Dashboard | Samsen</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#14213b;font:14px Arial}.top{background:#08245b;color:white;padding:20px max(20px,calc((100vw - 1100px)/2));display:flex;justify-content:space-between;align-items:center}.top strong{letter-spacing:2px}.wrap{max-width:1100px;margin:35px auto;padding:0 20px}.grid{display:grid;grid-template-columns:360px 1fr;gap:25px}.panel{background:white;padding:25px;border-top:4px solid #a80b3c;box-shadow:0 8px 28px #13264a0b}h1{font-size:28px}h2{font-size:18px;margin-top:0}label{display:block;font-size:11px;font-weight:bold;margin:15px 0 6px}input,textarea,select{width:100%;padding:11px;border:1px solid #ccd2dc;font:14px Arial}textarea{min-height:90px}button,.btn{border:0;background:#a80b3c;color:white;padding:12px 16px;font-weight:bold;cursor:pointer;text-decoration:none;display:inline-block}.muted{color:#69758a;line-height:1.6}.project{display:grid;grid-template-columns:110px 1fr auto;gap:15px;align-items:center;padding:14px 0;border-bottom:1px solid #e6e9ef}.project img{width:110px;height:76px;object-fit:cover;background:#e5e9ef}.project h3{margin:0 0 6px}.project p{margin:0;color:#69758a;font-size:12px}.delete{background:#08245b}.logout{background:#a80b3c}@media(max-width:760px){.grid{grid-template-columns:1fr}.project{grid-template-columns:80px 1fr}.project img{width:80px;height:70px}.project form{grid-column:2}.top{gap:10px}}</style></head><body><header class="top"><strong>SAMSEN · ADMIN</strong><form method="post" action="/admin/logout"><input type="hidden" name="csrf_token" value="{{csrf_token}}"><button class="logout">Log out</button></form></header><main class="wrap"><h1>Project dashboard</h1><p class="muted">Add and remove approved company project photographs. Changes appear in the public website gallery.</p><div class="grid"><section class="panel"><h2>Add a project</h2><form method="post" action="/admin/projects" enctype="multipart/form-data"><input type="hidden" name="csrf_token" value="{{csrf_token}}"><label>PROJECT TITLE *</label><input name="title" maxlength="140" required><label>CATEGORY</label><select name="category"><option>Construction</option><option>Residential</option><option>Commercial</option><option>Interior</option><option>Layout Development</option><option>Other</option></select><label>LOCATION</label><input name="location" maxlength="160"><label>DESCRIPTION</label><textarea name="description" maxlength="1200"></textarea><label>PROJECT IMAGE * (JPG / PNG / WEBP, max 5 MB)</label><input type="file" name="image" accept=".jpg,.jpeg,.png,.webp" required><button style="width:100%;margin-top:18px">Publish project</button></form></section><section class="panel"><h2>Published projects ({{projects|length}})</h2>{% if not projects %}<p class="muted">No projects added yet. Add your first verified project using the form.</p>{% endif %}{% for p in projects %}<article class="project"><img src="{{p['image']}}" alt=""><div><h3>{{p['title']}}</h3><p>{{p['category']}} · {{p['location']}}</p></div><form method="post" action="/admin/projects/{{p['id']}}/delete" onsubmit="return confirm('Delete this project?')"><input type="hidden" name="csrf_token" value="{{csrf_token}}"><button class="delete">Delete</button></form></article>{% endfor %}</section></div></main></body></html>
"""

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
