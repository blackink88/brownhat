# brownhat

Brown Hat Academy custom Frappe LMS app. Provides:

- **Lab orchestrator API endpoints** (`brownhat.lms.api`) — flag submission, Student Lab tracking, container lifecycle.
- **Embedded Socratic tutor** (`brownhat.install_tutor` + `public/js/bh_tutor.bundle.js`) — animated cyberbot chat widget that auto-mounts on every Frappe LMS lesson page, streams responses from Anthropic Haiku via the Vercel `/api/tutor` endpoint, and grounds every answer in the current lesson's content.

## Install

On a Frappe bench (Private Bench plan on Frappe Cloud, or self-hosted):

```bash
cd /home/frappe/frappe-bench
bench get-app https://github.com/blackink88/brownhat
bench --site lms-dzr-tbs.c.frappe.cloud install-app brownhat
bench build --app brownhat
bench --site lms-dzr-tbs.c.frappe.cloud clear-cache
bench restart
```

On install:
1. App is registered and `brownhat/lms/api.py` exposes the lab orchestrator endpoints.
2. The `after_install` hook patches `apps/lms/lms/www/lms.html` to load the tutor bundle.
3. `app_include_js` also loads the bundle on standard Frappe website pages.

Verify the LMS template patch:

```bash
grep "bh-tutor:injected" apps/lms/lms/www/lms.html
```

## Update (after editing the bundle or Python)

```bash
cd /home/frappe/frappe-bench
git -C apps/brownhat pull
bench build --app brownhat
bench --site lms-dzr-tbs.c.frappe.cloud migrate   # re-runs the template patch
bench --site lms-dzr-tbs.c.frappe.cloud clear-cache
bench restart
```

## Tutor configuration

The widget calls the Vercel-hosted endpoint at `https://portal.brownhat.academy/api/tutor` by default. Override per-page with:

```html
<script>window.BH_TUTOR_ENDPOINT = "https://my-other-endpoint/api/tutor";</script>
```

The Vercel endpoint requires `ANTHROPIC_API_KEY` env var. Optional overrides:
- `ANTHROPIC_MODEL`     (default: `claude-haiku-4-5-20251001`)
- `TUTOR_MAX_TOKENS`    (default: `800`)
- `TUTOR_MAX_HISTORY`   (default: `10`)

## Uninstall

```bash
bench --site lms-dzr-tbs.c.frappe.cloud uninstall-app brownhat
```

The `before_uninstall` hook removes the tutor `<script>` tag from `lms.html`.

## Repo layout

```
brownhat/
├── brownhat/
│   ├── __init__.py
│   ├── hooks.py                          # app metadata + lifecycle hooks
│   ├── install_tutor.py                  # patches lms.html
│   ├── lms/
│   │   ├── __init__.py
│   │   └── api.py                        # lab orchestrator API
│   ├── modules.txt                       # "LMS"
│   ├── patches.txt
│   └── public/
│       └── js/
│           └── bh_tutor.bundle.js        # the cyberbot widget (~31KB)
├── pyproject.toml
├── requirements.txt
├── setup.py
└── README.md
```

## License

MIT
