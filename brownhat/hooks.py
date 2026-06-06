app_name      = "brownhat"
app_title     = "Brown Hat"
app_publisher = "Brown Hat Academy"
app_description = "Custom LMS extensions: lab orchestrator API, flag submission, Student Lab tracking, embedded Socratic tutor"
app_email     = "com.popa@gmail.com"
app_license   = "MIT"

# NOTE: Frappe Cloud Press reads compatibility from pyproject.toml's
# [tool.bench] section. Do NOT also put it in `required_apps` here — Frappe's
# core installer treats `required_apps` as bare app names and will try to
# `bench get-app frappe>=15.0.0 <17.0.0` which fails as an InvalidRemoteException.

# Bundled assets included on every Frappe page that extends web.html.
# (The LMS Vue SPA does NOT extend web.html; the install hook below patches
# the LMS template directly to load the same bundle.)
app_include_js = ["/assets/brownhat/js/bh_tutor.bundle.js"]

# Tutor template patching: injects the widget <script> into apps/lms/lms/www/lms.html
# on install, and re-applies on every migrate so it survives LMS app upgrades.
after_install    = "brownhat.install_tutor.patch_lms_template"
after_migrate    = "brownhat.install_tutor.patch_lms_template"
before_uninstall = "brownhat.install_tutor.unpatch_lms_template"
