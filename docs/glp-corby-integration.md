# Placemaker integration guide — GLP Corby site

You are working on the GLP Corby consultation website. This guide tells you how to wire
that site into Placemaker, the consultation platform that collects and analyses its
feedback. The site keeps its own domain, design and CMS — Placemaker is reached only
through iframes and JSON APIs described below.

## Constants

- Platform base URL: `https://platform.placemakerai.io`
- Project ID: `cmtu4dmd80000j1xet4f8hwl1`

Use these in every URL below. There is one mailing list, one enquiry inbox and one
feedback map **per project** — the project ID in the URL is the only routing. No API
keys are needed; these are public endpoints.

## Prerequisite (Placemaker side — not yours)

The project must have **Public Embedding enabled** in the Placemaker dashboard. Until
then, every endpoint below returns 403 (`"Signups not enabled"` / `"Enquiries not
enabled"`). If you get 403s, tell Will to flip the toggle in the project's Website tab
— do not try to work around it.

## General API rules (apply to every endpoint)

- Send `Content-Type: application/json` with a JSON body.
- `gdprConsent` must be JSON boolean `true` — the strings `"true"`, `"on"`, `"yes"`
  are **rejected or miscounted**. Build the payload in JS, don't serialise raw form data.
- **Unknown fields are rejected with a 400** that names the offending keys. Send
  exactly the documented fields, nothing else (no honeypots, no plugin metadata).
- Validation errors come back as `{ "error": "..." }` listing every problem at once.
  Surface that string to the user — it's written to be shown.
- CORS is open (`*`): POST straight from the visitor's browser. Prefer that over
  server-side proxying — rate limits are per-IP (5/min for subscribe and enquiries,
  10/min for feedback), and browser-side spreads them across visitors.

## 1. Mailing list signup

```
POST {base}/api/embed/cmtu4dmd80000j1xet4f8hwl1/subscribe
{ "email": "jane@example.com", "gdprConsent": true, "name": "Jane" }  // name optional
```

Success: `{ "success": true, "message": "You're subscribed to project updates." }` —
show `message` verbatim. The response is identical for new and already-subscribed
addresses (deliberately — the endpoint must not reveal who is on the list).
Unsubscribe is handled entirely by Placemaker (a link in every email it sends);
build nothing for it.

Drop-in form (unstyled on purpose — the site's own CSS applies):

```html
<form id="pm-signup" novalidate>
  <label>Name <input name="name"></label>
  <label>Email <input name="email" type="email" required></label>
  <label><input name="gdprConsent" type="checkbox" required>
    I agree to receive email updates about this project.</label>
  <button type="submit">Subscribe</button>
  <p id="pm-signup-status" role="status"></p>
</form>

<script>
document.getElementById('pm-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById('pm-signup-status');
  const btn = form.querySelector('button');

  btn.disabled = true;
  status.textContent = 'Subscribing…';
  try {
    const res = await fetch(
      'https://platform.placemakerai.io/api/embed/cmtu4dmd80000j1xet4f8hwl1/subscribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.value,
          name: form.name.value || undefined,
          gdprConsent: form.gdprConsent.checked,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    form.reset();
    status.textContent = data.message;
  } catch (err) {
    status.textContent = err.message;
    btn.disabled = false;
  }
});
</script>
```

If the site already has a newsletter form, rewire it to this endpoint rather than
running two lists — but map its fields to exactly `email` / `name` / `gdprConsent`.

## 2. Enquiry form

Two options.

**Option A — iframe the hosted form (zero code):**

```html
<iframe src="https://platform.placemakerai.io/embed/cmtu4dmd80000j1xet4f8hwl1/enquiry"
        style="width:100%; height:900px; border:0;" title="Submit an enquiry"></iframe>
```

**Option B — the site's own form, posting to:**

```
POST {base}/api/embed/cmtu4dmd80000j1xet4f8hwl1/enquiries
{
  "submitterName": "...",      // required
  "submitterEmail": "...",     // required
  "subject": "...",            // required
  "message": "...",            // required
  "submitterPhone": "...",     // optional
  "submitterOrg": "...",       // optional
  "category": "general",       // optional: general|planning|objection|support|complaint
  "gdprConsent": true,         // required
  "mailingConsent": true       // optional — see below
}
```

Success returns `{ "success": true, "reference": "<id>" }` — show the reference as a
confirmation number. Enquiries land in the project's enquiry inbox and feed its AI
analysis; staff reply by email from Placemaker.

**`mailingConsent: true` on an enquiry also adds the person to the mailing list** (only
when it is boolean `true`). If you build a custom enquiry form, include an unticked
"I'd also like to receive email updates about this project" checkbox mapped to it —
one form, both purposes.

## 3. Interactive feedback map

```html
<iframe src="https://platform.placemakerai.io/embed/cmtu4dmd80000j1xet4f8hwl1"
        title="Consultation map" width="100%" height="600"
        loading="lazy" allow="geolocation"
        style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>
```

Visitors drop pins and comments directly in the iframe; nothing else to wire. Its
colours/fonts are configured on the Placemaker side, not in the site's CSS.

## 4. Guided tour (optional)

If the project has a published tour, embed it as its own iframe — it walks visitors
through the proposals stop by stop on the map, with a response box at each stop:

```html
<iframe src="https://platform.placemakerai.io/embed/cmtu4dmd80000j1xet4f8hwl1/tour"
        title="Site tour" width="100%" height="640"
        loading="lazy"
        style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>
```

The tour opens automatically inside the iframe; nothing else to wire. If the page shows
"No Tour Available", no tour has been published yet — ask Will, don't work around it.
(The main feedback map iframe in §3 also grows a "Take the tour" button once a tour is
published; the dedicated iframe above is for a standalone tour section.)

## 5. General feedback/survey forms (optional)

An existing site form (contact, survey) can also feed the feedback corpus:

```
POST {base}/api/projects/cmtu4dmd80000j1xet4f8hwl1/feedback
{ "name": "...", "email": "...", "<any other fields>": "...", "gdprConsent": true }
```

Unlike the endpoints above, this one accepts arbitrary field names (they become form
fields in Placemaker automatically). `mailingConsent: true` works here too, provided
an email field is present. Payload limit 20 KB.

## Verify your work

After wiring each form, prove it end-to-end — a 200 is the only acceptable evidence:

```bash
curl -s -X POST \
  https://platform.placemakerai.io/api/embed/cmtu4dmd80000j1xet4f8hwl1/subscribe \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","gdprConsent":true}'
```

- `{"success":true,...}` → wired correctly (tell Will to delete the test entry).
- 403 → embedding not enabled yet (Placemaker side; see Prerequisite).
- 400 → read the error string; it names the exact field problems.
- 404 → wrong project ID in the URL.
- 429 → rate-limited; wait a minute.

Then submit once through the real UI in a browser and confirm the success message
renders and the form resets.
