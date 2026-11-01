#!/usr/bin/env python3
"""Turn OpenCode's JSON findings into one GitHub PR review with inline comments.

  ranges <diff-file>                       print the commentable (RIGHT side) line ranges per file
  post   <diff-file> <opencode-output>     validate findings against the diff and post the review

GitHub rejects review comments on lines outside the diff hunks, so every finding is checked
against the diff first. Findings that cannot be placed go into the review body instead.
If the review API call still fails, everything is posted as one plain PR comment.
Never prints request headers or tokens.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
SEVERITY_ICON = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}
MAX_INLINE = 30


def parse_diff(path):
    """{file: {"lines": set(new-file lines in hunks), "hunks": [(start, end)]}}"""
    files, cur, new_line, hunk = {}, None, 0, None
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            line = raw.rstrip("\n")
            if line.startswith("diff --git "):
                cur = None
            elif line.startswith("+++ "):
                name = line[4:].strip()
                cur = None if name == "/dev/null" else name[2:] if name.startswith("b/") else name
                if cur:
                    files.setdefault(cur, {"lines": set(), "hunks": []})
            elif cur and (m := HUNK.match(line)):
                new_line = int(m.group(1))
                hunk = [new_line, new_line - 1]
                files[cur]["hunks"].append(hunk)
            elif cur and hunk is not None:
                if line.startswith("-") or line.startswith("\\"):
                    continue
                if line.startswith("+") or line.startswith(" ") or line == "":
                    files[cur]["lines"].add(new_line)
                    hunk[1] = new_line
                    new_line += 1
    return files


def cmd_ranges(diff_path):
    for name, info in sorted(parse_diff(diff_path).items()):
        spans = ", ".join(f"{a}-{b}" for a, b in info["hunks"] if b >= a)
        print(f"{name}: {spans}")


def extract_findings(text):
    """Last <<<FINDINGS_JSON ... FINDINGS_JSON>>> block, else the last {...} that parses."""
    blocks = re.findall(r"<<<FINDINGS_JSON\s*(.*?)\s*FINDINGS_JSON>>>", text, re.S)
    candidates = blocks[::-1] or re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)[::-1]
    for cand in candidates:
        cand = re.sub(r"^```(?:json)?\s*|\s*```$", "", cand.strip())
        try:
            data = json.loads(cand)
            if isinstance(data, dict) and isinstance(data.get("findings"), list):
                return data
        except json.JSONDecodeError:
            continue
    return None


def api(method, url, payload):
    if os.environ.get("DRY_RUN"):
        print(json.dumps({"method": method, "url": url, "payload": payload}, ensure_ascii=False)[:3000])
        return 200, {}
    req = urllib.request.Request(url, method=method, data=json.dumps(payload).encode())
    req.add_header("Authorization", "Bearer " + os.environ["GITHUB_TOKEN"])
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as err:
        return err.code, {"message": err.read().decode(errors="replace")[:500]}


def fmt_finding(f, with_location):
    sev = str(f.get("severity", "medium")).lower()
    head = f"{SEVERITY_ICON.get(sev, '⚪')} **[{sev}] {f.get('title', '').strip()}**"
    if with_location:
        loc = f"{f.get('path')}:{f.get('line')}"
        head = f"{head} — `{loc}`"
    body = str(f.get("body", "")).strip()
    sugg = f.get("suggestion")
    out = f"{head}\n\n{body}"
    if with_location and sugg:
        out += f"\n\n```ts\n{sugg.rstrip()}\n```"
    return out


def cmd_post(diff_path, output_path):
    repo, pr, sha = os.environ["REPO"], os.environ["PR_NUMBER"], os.environ["HEAD_SHA"]
    model = os.environ.get("MODEL", "")
    files = parse_diff(diff_path)
    text = open(output_path, encoding="utf-8", errors="replace").read()
    data = extract_findings(text)
    base = f"https://api.github.com/repos/{repo}"
    marker = "<!-- opencode-inline-review -->"

    if data is None:
        # Model did not return parsable JSON: keep the old behaviour (one big comment).
        tail = text.strip()[-60000:] or "(no output)"
        body = f"{marker}\n## OpenCode review ({model})\n\n> ⚠️ ไม่ได้ JSON ที่อ่านได้ จึงโพสต์ข้อความเต็มแทน inline\n\n{tail}"
        status, _ = api("POST", f"{base}/issues/{pr}/comments", {"body": body})
        print(f"no JSON findings; posted fallback comment (HTTP {status})")
        return 0 if status < 300 else 1

    findings = sorted(data["findings"], key=lambda f: SEVERITY_ORDER.get(str(f.get("severity", "")).lower(), 9))
    inline, leftover = [], []
    for f in findings:
        path = str(f.get("path", "")).lstrip("./")
        try:
            line = int(f.get("line"))
            start = int(f.get("start_line") or line)
        except (TypeError, ValueError):
            leftover.append(f)
            continue
        info = files.get(path)
        if start > line:
            start, line = line, start
        same_hunk = info and any(a <= start and line <= b for a, b in info["hunks"])
        if not info or line not in info["lines"] or not same_hunk or len(inline) >= MAX_INLINE:
            leftover.append(f)
            continue
        sev = str(f.get("severity", "medium")).lower()
        body = f"{SEVERITY_ICON.get(sev, '⚪')} **[{sev}] {str(f.get('title', '')).strip()}**\n\n{str(f.get('body', '')).strip()}"
        if f.get("suggestion"):
            body += f"\n\n```suggestion\n{str(f['suggestion']).rstrip()}\n```"
        c = {"path": path, "line": line, "side": "RIGHT", "body": body}
        if start != line:
            c.update(start_line=start, start_side="RIGHT")
        inline.append(c)

    counts = {}
    for f in findings:
        s = str(f.get("severity", "medium")).lower()
        counts[s] = counts.get(s, 0) + 1
    count_txt = " · ".join(f"{SEVERITY_ICON.get(k, '⚪')} {k} {v}" for k, v in sorted(counts.items(), key=lambda kv: SEVERITY_ORDER.get(kv[0], 9)))
    parts = [marker, f"## OpenCode review ({model})", f"พบ **{len(findings)}** ประเด็น ({count_txt}) — inline {len(inline)} / ในสรุปนี้ {len(leftover)}"]
    if data.get("summary"):
        parts.append(str(data["summary"]).strip())
    if leftover:
        parts.append("### ประเด็นที่วางเป็น inline ไม่ได้ (นอก diff หรือไม่ระบุบรรทัด)")
        parts.extend(fmt_finding(f, True) for f in leftover)
    review = {"commit_id": sha, "event": "COMMENT", "body": "\n\n".join(parts), "comments": inline}
    status, resp = api("POST", f"{base}/pulls/{pr}/reviews", review)
    if status < 300:
        print(f"posted review: {len(inline)} inline, {len(leftover)} in body")
        return 0

    print(f"review API failed (HTTP {status}): {resp.get('message', '')[:300]}; falling back to one comment")
    allf = "\n\n".join(fmt_finding(f, True) for f in findings)
    body = "\n\n".join(parts[:4] + ["### ประเด็นทั้งหมด", allf])
    status, _ = api("POST", f"{base}/issues/{pr}/comments", {"body": body[:65000]})
    print(f"fallback comment HTTP {status}")
    return 0 if status < 300 else 1


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "ranges":
        cmd_ranges(sys.argv[2])
    elif len(sys.argv) == 4 and sys.argv[1] == "post":
        sys.exit(cmd_post(sys.argv[2], sys.argv[3]))
    else:
        sys.exit(__doc__)
