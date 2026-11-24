"""Read-only probes and the daily MyTilesTrial health report."""
import argparse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import json
import os
from pathlib import Path
import smtplib
import ssl
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

IST = timezone(timedelta(hours=5, minutes=30), "IST")
TIMEOUT_SECONDS = 12


@dataclass(frozen=True)
class Probe:
    name: str
    url: str
    status: int = 200
    check: str = ""
    method: str = "GET"


@dataclass(frozen=True)
class Result:
    name: str
    ok: bool
    detail: str


def probes(site, api):
    return [
        Probe("Homepage", site + "/"),
        Probe("Landing page", site + "/landing"),
        Probe("Login page", site + "/login"),
        Probe("API health", api + "/v1/health", check="health"),
        Probe("Plans and payment settings", api + "/v1/catalog", check="catalog"),
        Probe("Visualizer templates", api + "/v1/templates", check="templates"),
        Probe("Account requires sign-in", api + "/v1/me", 401, "auth"),
        Probe("Floor Planner requires sign-in", api + "/v1/generations/floor-preview", 401, "auth", "POST"),
    ]


def valid_payload(check, payload):
    if not isinstance(payload, dict):
        return False
    if check == "health":
        return payload.get("status") == "ok"
    if check == "catalog":
        packs = payload.get("packs")
        payments = payload.get("payments")
        return isinstance(packs, list) and bool(packs) and isinstance(payments, dict) and bool(payments.get("provider"))
    if check == "templates":
        return isinstance(payload.get("templates"), list) and bool(payload["templates"])
    if check == "auth":
        error = payload.get("error")
        return isinstance(error, dict) and error.get("code") == "UNAUTHORIZED"
    return False


def run_probe(probe):
    start = time.monotonic()
    body = b"{}" if probe.method == "POST" else None
    request = Request(
        probe.url, data=body, method=probe.method,
        headers={"Accept": "*/*", **({"Content-Type": "application/json"} if body else {})},
    )
    try:
        try:
            response = urlopen(request, timeout=TIMEOUT_SECONDS)
        except HTTPError as error:
            response = error
        with response:
            elapsed = round((time.monotonic() - start) * 1000)
            status = response.code
            if status != probe.status:
                return Result(probe.name, False, f"HTTP {status}, expected {probe.status} ({elapsed} ms)")
            if probe.check:
                try:
                    payload = json.loads(response.read(512 * 1024))
                except (ValueError, UnicodeError):
                    return Result(probe.name, False, "Expected a JSON response")
                if not valid_payload(probe.check, payload):
                    return Result(probe.name, False, "Response did not match the expected shape")
            return Result(probe.name, True, f"HTTP {status} ({elapsed} ms)")
    except (OSError, URLError, ValueError) as error:
        # The report contains no response bodies, headers, or connection credentials.
        return Result(probe.name, False, type(error).__name__)


def previous_runs(now):
    repository = os.environ.get("GITHUB_REPOSITORY")
    token = os.environ.get("GITHUB_TOKEN")
    if not repository or not token:
        return ["Run history unavailable outside GitHub Actions."]

    params = urlencode({
        "event": "schedule",
        "created": ">=" + (now - timedelta(hours=24)).isoformat(timespec="seconds"),
        "per_page": 50,
    })
    url = f"https://api.github.com/repos/{repository}/actions/workflows/health-monitor.yml/runs?{params}"
    request = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            runs = json.load(response)["workflow_runs"]
    except (OSError, ValueError, KeyError):
        return ["Could not retrieve the last 24 hours of scheduled checks."]
    completed = [run for run in runs if run["status"] == "completed"]
    if not completed:
        return ["No completed scheduled checks in the last 24 hours."]
    failed = [run for run in completed if run["conclusion"] in {"failure", "timed_out", "action_required"}]
    other = sum(run["conclusion"] not in {"failure", "timed_out", "action_required", "success"} for run in completed)
    total = f"{len(completed)} completed, {len(failed)} failed, {other} cancelled or skipped."
    return [total] + [
        f"- {run['created_at']} ({run['conclusion']}): https://github.com/{repository}/actions/runs/{run['id']}"
        for run in failed
    ]


def make_report(results, now, history=None):
    failures = sum(not item.ok for item in results)
    status = f"{failures} checks failed" if failures else "All checks passed"
    lines = [
        "# MyTilesTrial health report",
        now.astimezone(IST).strftime("%d %B %Y, %H:%M IST"),
        f"Status: {status}.",
        "",
        "## Latest checks",
        *[f"- {'PASS' if item.ok else 'FAIL'} {item.name}: {item.detail}" for item in results],
    ]
    if history is not None:
        lines.extend(["", "## Last 24 hours of scheduled checks", *history])
    return "\n".join(lines) + "\n"


def send_gmail(report, sender, password, recipient):
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = "MyTilesTrial daily health report"
    message.set_content(report)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=TIMEOUT_SECONDS, context=ssl.create_default_context()) as smtp:
        smtp.login(sender, password)
        smtp.send_message(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--daily", action="store_true")
    parser.add_argument("--send", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("health-report.md"))
    args = parser.parse_args()
    site = os.environ.get("MONITOR_SITE_URL", "").rstrip("/")
    api = os.environ.get("MONITOR_API_URL", "").rstrip("/")
    if not site.startswith("https://") or not api.startswith("https://"):
        print("Set MONITOR_SITE_URL and MONITOR_API_URL to the deployed HTTPS endpoints.")
        return 2

    now = datetime.now(timezone.utc)
    results = [run_probe(probe) for probe in probes(site, api)]
    report = make_report(results, now, previous_runs(now) if args.daily else None)
    args.output.write_text(report, encoding="utf-8")
    print(report, end="")

    if args.send:
        credentials = [os.environ.get(key) for key in ("MONITOR_GMAIL_ADDRESS", "MONITOR_GMAIL_APP_PASSWORD", "MONITOR_GMAIL_RECIPIENT")]
        if all(credentials):
            try:
                send_gmail(report, *credentials)
            except (OSError, smtplib.SMTPException, ValueError) as error:
                print(f"Report delivery failed ({type(error).__name__}).")
                return 1
        elif any(credentials):
            print("Report delivery requires all three Gmail secrets.")
            return 1
        else:
            print("No Gmail delivery configured. The report is available in GitHub Actions.")
    return int(any(not result.ok for result in results))


if __name__ == "__main__":
    raise SystemExit(main())
