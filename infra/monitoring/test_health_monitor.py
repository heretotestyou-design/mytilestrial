from datetime import datetime, timezone
from email.message import EmailMessage
from io import BytesIO, StringIO
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from health_monitor import Probe, Result, main, make_report, previous_runs, probes, run_probe, send_gmail


class Reply(BytesIO):
    def __init__(self, body, status=200):
        super().__init__(body)
        self.code = status


class HealthMonitorTests(unittest.TestCase):
    def test_probe_list_uses_no_auth_and_no_payment_routes(self):
        checks = probes("https://site.example.test", "https://api.example.test")
        posts = [check for check in checks if check.method == "POST"]
        self.assertEqual(len(posts), 1)
        self.assertTrue(posts[0].url.endswith("/v1/generations/floor-preview"))
        self.assertEqual(posts[0].status, 401)
        self.assertFalse(any("checkout" in check.url for check in checks))

    @patch("health_monitor.urlopen")
    def test_reports_missing_floor_route_and_does_not_send_credentials(self, open_url):
        open_url.side_effect = HTTPError("https://api.example.test", 405, "wrong route", None, BytesIO())
        probe = probes("https://site.example.test", "https://api.example.test")[-1]
        result = run_probe(probe)
        self.assertFalse(result.ok)
        self.assertIn("HTTP 405, expected 401", result.detail)
        request = open_url.call_args.args[0]
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.data, b"{}")
        self.assertIsNone(request.get_header("Authorization"))

    @patch("health_monitor.urlopen")
    def test_expected_auth_response_passes(self, open_url):
        open_url.side_effect = HTTPError(
            "https://api.example.test", 401, "signed out", None, BytesIO(b'{"error":{"code":"UNAUTHORIZED"}}'),
        )
        self.assertTrue(run_probe(Probe("Auth", "https://api.example.test", 401, "auth")).ok)

    @patch("health_monitor.urlopen")
    def test_flags_invalid_json_empty_catalog_and_network_errors(self, open_url):
        probe = Probe("Catalog", "https://api.example.test", check="catalog")
        open_url.return_value = Reply(b"<html>Proxy error</html>")
        self.assertEqual(run_probe(probe).detail, "Expected a JSON response")
        open_url.return_value = Reply(b'{"packs":[]}')
        self.assertFalse(run_probe(probe).ok)
        open_url.side_effect = URLError("private connection information")
        self.assertEqual(run_probe(probe).detail, "URLError")

    def test_report_has_local_time_and_separates_current_and_historical_failures(self):
        now = datetime(2026, 11, 24, 3, 37, tzinfo=timezone.utc)
        report = make_report([Result("API", False, "HTTP 503")], now, ["1 failure yesterday"])
        self.assertIn("24 November 2026, 09:07 IST", report)
        self.assertIn("FAIL API", report)
        self.assertIn("1 failure yesterday", report)

    @patch.dict(os.environ, {"GITHUB_REPOSITORY": "owner/application", "GITHUB_TOKEN": "fixture-token"}, clear=True)
    @patch("health_monitor.urlopen")
    def test_history_counts_results_and_links_to_failed_runs(self, open_url):
        now = datetime(2026, 11, 24, 3, 37, tzinfo=timezone.utc)
        open_url.return_value = Reply(json.dumps({"workflow_runs": [
            {"status": "in_progress", "conclusion": None},
            {"status": "completed", "conclusion": "success"},
            {"status": "completed", "conclusion": "failure", "id": 44, "created_at": "2026-11-23T10:00:00Z"},
        ]}).encode())
        summary, issue = previous_runs(now)
        self.assertIn("2 completed, 1 failed", summary)
        self.assertIn("/actions/runs/44", issue)

    @patch("health_monitor.smtplib.SMTP_SSL")
    def test_gmail_uses_tls_and_sends_the_report(self, smtp_ssl):
        send_gmail("report contents", "sender@example.test", "generated-fixture", "recipient@example.test")
        client = smtp_ssl.return_value.__enter__.return_value
        client.login.assert_called_once_with("sender@example.test", "generated-fixture")
        message = client.send_message.call_args.args[0]
        self.assertIsInstance(message, EmailMessage)
        self.assertEqual(message["To"], "recipient@example.test")
        self.assertEqual(message.get_content().strip(), "report contents")

    @patch.dict(os.environ, {"MONITOR_SITE_URL": "https://site.example.test", "MONITOR_API_URL": "https://api.example.test"}, clear=True)
    @patch("health_monitor.run_probe")
    @patch("health_monitor.send_gmail")
    def test_failure_still_archives_report_and_missing_delivery_never_sends(self, send, run):
        run.return_value = Result("API", False, "HTTP 503")
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / "report.md"
            with patch("sys.argv", ["health_monitor.py", "--daily", "--send", "--output", str(out)]), patch("sys.stdout", StringIO()):
                self.assertEqual(main(), 1)
            self.assertIn("FAIL API", out.read_text(encoding="utf-8"))
        send.assert_not_called()

    @patch.dict(os.environ, {
        "MONITOR_SITE_URL": "https://site.example.test",
        "MONITOR_API_URL": "https://api.example.test",
        "MONITOR_GMAIL_ADDRESS": "sender@example.test",
        "MONITOR_GMAIL_APP_PASSWORD": "test-fixture",
        "MONITOR_GMAIL_RECIPIENT": "daily@example.test",
        "MONITOR_GMAIL_TEST_RECIPIENT": "test@example.test",
    }, clear=True)
    @patch("health_monitor.run_probe", return_value=Result("API", True, "HTTP 200"))
    @patch("health_monitor.send_gmail")
    def test_manual_email_only_targets_the_test_recipient(self, send, _run):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / "report.md"
            with patch("sys.argv", ["health_monitor.py", "--test-email", "--output", str(out)]), patch("sys.stdout", StringIO()):
                self.assertEqual(main(), 0)
        self.assertEqual(send.call_args.args[3], "test@example.test")
        self.assertEqual(send.call_args.kwargs["subject"], "[Test] MyTilesTrial health report")


if __name__ == "__main__":
    unittest.main()
