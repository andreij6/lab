#!/usr/bin/env python3
"""Mail in: file an email as a note under Inbox/Mail through the notebook's agent API.

  usage: mail_in.py <notebook url> <inbox key> < message.eml

Make the key on Manage -> Agents -> "Make an Inbox key" (it is scoped to Inbox/). Point a forwarding
rule, a procmail/sieve script or a cron over an IMAP folder at this script; each message becomes
`Inbox/Mail/<date> <subject>.md` with the sender, the recipients and the text body.
"""
import email
import json
import re
import sys
import urllib.request
from email import policy


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    base, key = sys.argv[1].rstrip("/"), sys.argv[2]
    msg = email.message_from_binary_file(sys.stdin.buffer, policy=policy.default)
    subject = (msg["subject"] or "(no subject)").strip()
    date = msg["date"]
    try:
        day = email.utils.parsedate_to_datetime(date).date().isoformat() if date else ""
    except Exception:
        day = ""
    body = msg.get_body(preferencelist=("plain", "html"))
    text = body.get_content() if body else ""
    if body is not None and body.get_content_type() == "text/html":
        text = re.sub(r"<[^>]+>", " ", text)
    safe = re.sub(r"[#^\[\]|\\/:]", " ", subject)[:80].strip()
    note = (f"---\nsource: mail\nfrom: {msg['from']}\ndate: {day}\n---\n# {subject}\n\n"
            f"**From** {msg['from']}  \n**To** {msg['to']}  \n**Date** {date}\n\n{text.strip()}\n")
    req = urllib.request.Request(f"{base}/v1/write", data=json.dumps({"path": f"Inbox/Mail/{day} {safe}.md".replace("Mail/ ", "Mail/"), "content": note}).encode(),
                                 method="POST", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        print(r.read().decode())
    return 0


if __name__ == "__main__":
    sys.exit(main())
