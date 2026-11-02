# AI PR review สำหรับ erp-api (ชุดสุดท้าย: 2 workflow)

| Workflow | หน้าที่ | ทำงานเมื่อ |
|---|---|---|
| `.github/workflows/ocr-review.yml` | **ตัวรีวิวตัวเดียว** ใช้ OCR (alibaba/open-code-review v1.13.3) + `deepseek-v4.1-flash` เปิด thinking ภาษาไทย มี inline comment และ sticky summary | PR ที่ไม่ใช่ draft: opened / reopened / push (synchronize); ทุก PR (รวม draft): ติด label `ai-review`; ready_for_review ทุกครั้ง (รีวิวทั้ง PR) |
| `.github/workflows/opencode.yml` | **สรุปอย่างเดียว** (ไม่รีวิว ไม่มี inline) OpenCode เขียนสรุปภาษาไทยว่า PR เกี่ยวกับอะไร เปลี่ยนอะไรหลัก ๆ และจุดที่ reviewer ควรดู แล้วโพสต์เป็น comment สรุปทั้ง PR 1 อัน และ push ต่อมาได้ comment "อัปเดต PR" แยกต่อ push **ไม่แก้ PR body** | เฉพาะ PR ที่ **ไม่มี description** (ดูหัวข้อ "เงื่อนไขของ OpenCode summary") |

PR-Agent ถูกถอดออกแล้ว (`pr-agent.yml`, `.pr_agent.toml`) ส่วนคำสั่ง `/oc` ใน comment ก็ถอดออกด้วย เพราะต้องใช้ trigger `issue_comment` + สิทธิ์เพิ่ม และไม่อยู่ในขอบเขต "สรุปอย่างเดียว" ถ้าอยากให้ OCR รีวิวใหม่ให้เอา label `ai-review` ออกแล้วติดใหม่

ทั้ง 2 workflow รับเฉพาะ event `pull_request` (**ไม่มี workflow_dispatch / ปุ่ม Run workflow**) เพราะ credential แบบ service account ของ OpenCode เชื่อถือเฉพาะ workflow ที่รันจาก pull request

ไฟล์อื่น: `.opencodereview/rule.json` คือกฎรีวิวภาษาไทยและรายการไฟล์ที่ไม่ต้องรีวิว (OCR อ่านเอง)

## สิ่งที่ Earth ต้องทำเอง (ครั้งเดียว)
1. **OpenCode Console** (workspace ที่มี Go subscription)
   - **แนะนำ: service account** (ไม่ต้องเก็บ key ใน GitHub) สร้าง credential แบบ GitHub Actions ขอบเขต "Workflows in <owner>/<repo> for pull requests" แล้วจด client id (`sk_...` ไม่ใช่ความลับ) ทุกรัน workflow จะขอ OIDC token จาก GitHub (audience `https://opencode.ai/console`) แล้วแลกเป็น token อายุ 1 ชั่วโมงที่ `https://opencode.ai/console/auth/oauth/token` ใช้โควตา Go เดิม (playground: `billing_source: "go"`, `cost: 0`)
   - หรือแบบเดิม: สร้าง API key `oc_sk_...`
   - Settings › Privacy › Regions เลือก **Global** (ไม่เลือก DeepSeek V4.1 Flash จะใช้ไม่ได้)
   - **ปิด** toggle "Allow paid endpoints that train on request data" (ดูหัวข้อ muse ด้านล่าง)
2. **GitHub repo erp-api** › Settings › Secrets and variables › Actions
   - Variable `OPENCODE_CLIENT_ID` = client id ของ service account (ตั้งแล้ว = ใช้ token เสมอ ไม่อ่าน secret) **หรือ** Secret `OPENCODE_GO_API_KEY` = key `oc_sk_...` (ใช้เมื่อไม่ได้ตั้ง `OPENCODE_CLIENT_ID`; ถ้าจะให้รีวิว PR ของ Dependabot ต้องใส่ชื่อเดียวกันใน **Dependabot secrets** ด้วย)
   - PR จาก fork ไม่ได้ทั้ง OIDC token และ secret → OCR fail ที่ "Sign in to OpenCode", summary ข้าม
   - Variables: ไม่ต้องใส่ก็ได้ ทุกตัวมี default (ตารางด้านล่าง) ถ้าเคยตั้ง `PR_AGENT_MODEL` ไว้ให้ลบทิ้ง
3. สร้าง label `ai-review` (Issues › Labels › New label) ถ้าจะใช้สั่งรีวิว draft
4. Settings › Actions › General: อนุญาตให้รัน Actions ได้ (และ Workflow permissions แบบ read ก็พอ เพราะแต่ละ job ขอ `pull-requests: write` เอง)
5. Merge 2 workflow + `rule.json` เข้า default branch และลบไฟล์ PR-Agent เดิมถ้ามี
6. วันที่ 1 พ.ย. 2026: เช็กหน้า Privacy ของ OpenCode Go ว่าข้อตกลง ZDR ของ DeepSeek (มีผลถึง 31 ต.ค. 2026) ต่ออายุแล้วหรือยัง

## Repo variables
| Variable | Default | ใช้กับ | ความหมาย |
|---|---|---|---|
| `OPENCODE_CLIENT_ID` | – | ทั้งคู่ | client id ของ service account (ไม่ใช่ความลับ) ตั้ง = ใช้ OIDC token, ไม่ตั้ง = ใช้ secret `OPENCODE_GO_API_KEY` |
| `OCR_MODEL` | `deepseek-v4.1-flash` | OCR | `deepseek-*` หรือ `glm-5.3-flash` |
| `OCR_PROTOCOL` | `anthropic` | OCR | `anthropic` หรือ `openai` |
| `OCR_THINKING` | `on` | OCR | `on` / `off` (anthropic + on = `budget_tokens: 8000`) |
| `OCR_REVIEW_DRAFTS` | `false` | OCR | `true` = รีวิว draft ทุก push ด้วย |
| `OCR_TRIGGER_LABEL` | `ai-review` | OCR | ติด label นี้ = รีวิวทันที แม้เป็น draft (และแม้ head อยู่ใน skip list เพราะถือเป็นการสั่งตรง ๆ) อยากรันอีกให้เอา label ออกแล้วติดใหม่ |
| `AI_SKIP_HEAD_BRANCHES` | `main,develop` | ทั้งคู่ | head branch ที่ไม่ต้องรีวิว/สรุป (PR release/sync) คั่นด้วย comma ไม่มีเว้นวรรค |
| `AI_SKIP_HEAD_PREFIX` | `release/` | ทั้งคู่ | head branch ที่ขึ้นต้นด้วยค่านี้จะถูกข้าม ใส่ `-` = ปิด |
| `OPENCODE_MODEL` | `opencode-go/deepseek-v4.1-flash` | summary | ต้องมี `opencode-go/` นำหน้า |
| `OPENCODE_SUMMARY_MIN_CHARS` | `30` | summary | ถ้า description มีตัวอักษรที่มีความหมายถึงค่านี้ ถือว่ามี description แล้ว ข้าม |
| `OPENCODE_SUMMARY_DRAFTS` | `false` | summary | `true` = สรุป draft ทุก push ด้วย (ค่าเริ่มต้น: draft สรุปเฉพาะเมื่อติด label `ai-review`) |

**ข้ามแค่ตาม head branch ไม่ข้ามตาม base** เพราะ flow ClickUp เปิด PR จาก branch งานเข้า `main` ได้ ส่วน PR ที่ head เป็น `develop`/`main`/`release/*` (sync/release) จะถูกข้าม **ไม่ข้าม PR ของ bot/agent**

## พฤติกรรมของ OCR review
- PR ที่ไม่ใช่ draft (เช่นเปิดตรง ๆ ไม่ผ่าน ClickUp): รันเมื่อ opened / reopened / synchronize เหมือนเดิม
- ready_for_review: รันทุกครั้ง แต่ OCR ในตัว action จะรีวิว **ทั้ง PR** เสมอเมื่อ event เป็น `ready_for_review`/`reopened` (`event_full_scope` ใน [post-review-comments.js](https://github.com/alibaba/open-code-review/blob/375f64cd6f67a48a135da83cfcf59c52669a09cb/scripts/github-actions/post-review-comments.js) ไม่มี input ให้ปิด) ดังนั้น **ready หลังรีวิวด้วย label แล้ว = รีวิวทั้ง PR อีกรอบ** (ยอมรับ: inline ที่ซ้ำบรรทัดเดิมไม่โพสต์ซ้ำเพราะ `incremental: true`, เสีย ~3 นาที runner)
- **ติด label `ai-review`** = รีวิวทันที ทำงานกับ draft ด้วย เป็นทางที่ bot ของ ClickUp จะใช้ตอนย้าย task ไป Review; label ค้างไว้ไม่ทำให้รีวิวทุก push ถ้าต้องการรันใหม่ให้ลบ label แล้วติดใหม่
- **push ใหม่ = รีวิวเฉพาะ commit ใหม่** (`checkpoint_range: true` + `sticky_summary: true`) OCR จด checkpoint ไว้ใน sticky summary comment แล้วรอบถัดไปรีวิวแค่ `<checkpoint>..<head ใหม่>` ถ้าหา checkpoint ไม่ได้ (เช่น force-push ทับ) จะกลับไปรีวิวทั้ง PR เอง (fail closed)
- `incremental: true` = ไม่โพสต์ inline ซ้ำบนบรรทัดที่มี comment ของ bot อยู่แล้ว (comment เก่าไม่ถูกลบ)
- 1 รันต่อ PR: push ใหม่ระหว่างรีวิวจะยกเลิกรันเก่า (cancel-in-progress) commit ของรันที่ถูกยกเลิกจะถูกรวมในรันถัดไป เพราะ checkpoint ยังเป็นของรอบที่จบล่าสุด
- draft: push เข้า draft ไม่รีวิว (`OCR_REVIEW_DRAFTS=false`) จนกว่าจะติด label
- Actions › OCR Review › Run workflow: ใส่ `pr_number` (ติ๊ก `full_review` = รีวิวทั้ง PR ใหม่โดยไม่สน checkpoint, override model/protocol/thinking ได้)
- Mapping model/protocol/thinking:

| model / protocol / thinking | สิ่งที่ส่งให้ OCR |
|---|---|
| deepseek-* / anthropic / on (**default**) | `{"thinking":{"type":"enabled","budget_tokens":8000}}` |
| deepseek-* / anthropic / off | `{"thinking":{"type":"disabled"}}` |
| deepseek-* / openai / on | `{"thinking":{"type":"enabled"}}` + `reasoning_effort: low` |
| deepseek-* / openai / off | `{"thinking":{"type":"disabled"}}` |
| glm-5.3-flash / ใดก็ได้ | บังคับ thinking on (มี warning) |
| model อื่น | workflow fail พร้อมบอกสาเหตุ |

- `budget_tokens` ต้องน้อยกว่า 16384 (เพดาน completion ของ OCR) จึงใช้ 8000 และห้ามใช้ effort `max` (#1532)
- Header: OCR ส่ง `User-Agent: open-code-review/1.13.3` เอง และ workflow ส่ง `x-opencode-session` ให้ Go ทำ prompt cache

## เงื่อนไขของ OpenCode summary
- รันเมื่อ opened / reopened / ready_for_review / synchronize (push), `edited` (เฉพาะตอนแก้ body) และติด label `ai-review`
- draft: สรุปเฉพาะเมื่อติด label `ai-review` อยู่ (ถือว่าเข้า Review แล้ว) push WIP เข้า draft ที่ไม่มี label ข้ามระดับ job 0 นาที
- ข้ามระดับ job (0 นาที): PR ที่ไม่มีไฟล์เปลี่ยน (`changed_files = 0` เช่น empty first commit), head branch ที่อยู่ใน skip list, label อื่น
- ขั้นแรก "Check description" ดู PR สด ๆ: ตัด HTML comment, heading (`#`), checklist (`- [ ]`/`- [x]`) และ bullet ว่างออก แล้วนับตัวอักษรที่ไม่ใช่ช่องว่าง ถ้า **≥ 30** ถือว่ามี description ข้าม (เสีย 1 นาที slim)
  - template ของ erp-api ที่ไม่ได้กรอก = 0 ตัวอักษร → สรุป
  - description จริงใน 40 PR ล่าสุดมีอย่างน้อย 67 ตัวอักษร → ข้าม
- **summary แรก = ทั้ง PR** (`base...head` ทุก commit) เป็น comment ของตัวเอง
- **push ต่อมา = comment ใหม่แยกต่อ push** หัวข้อ `🔄 อัปเดต PR (OpenCode): <before7>..<after7>` + รายการ commit (sha สั้น + ชื่อ commit จาก git) + สรุปเฉพาะ commit ใน push นั้น ไม่แตะ comment สรุปแรก
  - ทุก comment (สรุปแรกและอัปเดต) มี marker ซ่อน `<!-- opencode-pr-summary-sha: ... -->` = SHA ที่ comment นั้นครอบคลุม comment ที่เขียนล่าสุดคือ "SHA ล่าสุดที่สรุปแล้ว" ถ้า head = SHA นั้น ข้าม (เช่น ready หลัง label ที่สรุปไปแล้ว)
  - ช่วง commit: ปกติ = `event.before..event.after` ของ push นั้น ถ้า `before` ไม่ตรงกับ SHA ล่าสุดที่สรุป (push ระหว่างรันที่ถูก cancel, label ติดใหม่, ready) ใช้ `<SHA ล่าสุด>..head`
  - force-push / rebase (SHA ล่าสุดไม่ใช่บรรพบุรุษของ head แล้ว) → **สรุปทั้ง PR ใหม่** แทนที่ comment สรุปแรก (comment อัปเดตเก่ายังอยู่ แต่ commit ในนั้นอาจถูกเขียนทับไปแล้ว)
  - merge base เข้า branch: นับเฉพาะ commit ของ branch เอง (`--first-parent --no-merges`) ถ้ามีแต่ merge commit จะไม่โพสต์อะไร แค่ขยับ marker ใน comment ล่าสุด
- เขียน description เมื่อไหร่ comment หยุดอัปเดต (comment เดิมยังอยู่)
- 1 รันต่อ PR (concurrency ต่อ PR + cancel-in-progress) push ที่ยกเลิกรันเก่าจะถูกรวมใน comment อัปเดตถัดไป เพราะ marker ยังเป็นของรอบที่จบล่าสุด
- ความปลอดภัย: ปิด edit/webfetch ของ OpenCode, ให้ bash ได้แค่ `git diff/show/log`, โมเดลไม่ได้รับ GitHub token, key ส่งผ่าน env เท่านั้น (log แสดงเป็น `***`) และไม่มี step ไหน echo ค่า
- ติดตั้ง CLI เองแบบ pin `OPENCODE_VERSION` + cache (ไม่ใช้ composite action ของ opencode เพราะเรียก GitHub API แบบไม่ใส่ token แล้วโดน rate limit)
- รันบน `ubuntu-slim` (1 vCPU, $0.002/นาที, จำกัด 15 นาทีต่อ job) https://docs.github.com/en/actions/reference/runners/github-hosted-runners

## ตาราง scenario (ทุก event)
"body ว่าง" = description < 30 ตัวอักษรที่มีความหมาย (รวม template เปล่า) / "มี description" = ≥ 30

| เหตุการณ์ | OCR ทำอะไร | OpenCode ทำอะไร |
|---|---|---|
| เปิด PR ปกติ (ไม่ใช่ draft) body ว่าง | รีวิวทั้ง PR | สรุปทั้ง PR (comment ใหม่) |
| เปิด PR ปกติ มี description | รีวิวทั้ง PR | ข้าม (1 นาที slim) |
| push เข้า PR ปกติ body ว่าง | รีวิวเฉพาะ commit ใหม่ (checkpoint) | comment "อัปเดต PR" ใหม่ เฉพาะ commit ใน push นั้น |
| push เข้า PR ปกติ มี description | รีวิวเฉพาะ commit ใหม่ | ข้าม (1 นาที slim) |
| push หลัง merge base เข้า branch | base เปลี่ยน → รีวิวทั้ง PR ใหม่ | comment อัปเดตเฉพาะ commit ของ branch (merge อย่างเดียว = ไม่โพสต์, ขยับ marker) |
| force-push / rebase | checkpoint ใช้ไม่ได้ (`unknown_object`) → รีวิวทั้ง PR, inline ที่ซ้ำของเดิมไม่โพสต์ซ้ำ | สรุปทั้ง PR ใหม่ แทนที่ comment สรุปแรก |
| เปิด draft (ClickUp, empty commit) | ข้าม 0 นาที | ข้าม 0 นาที |
| push เข้า draft ที่ไม่มี label | ข้าม 0 นาที | ข้าม 0 นาที |
| push เข้า draft ที่ติด label แล้ว | ข้าม 0 นาที (label ค้างไม่รีวิวทุก push) | comment "อัปเดต PR" ใหม่ (ถ้า body ว่าง) |
| ติด label `ai-review` (draft หรือไม่ก็ได้) | รีวิว: ครั้งแรกทั้ง PR, ครั้งต่อไปเฉพาะ commit ใหม่ | body ว่าง: ยังไม่มี summary = สรุปทั้ง PR, มีแล้ว = comment อัปเดตสำหรับ commit ที่ยังไม่สรุป |
| เอา label ออกแล้วติดใหม่ ไม่มี commit ใหม่ | no-op (~12 วินาที) | ข้าม (สรุปถึง head แล้ว) |
| ready_for_review ไม่เคยติด label | รีวิวทั้ง PR | body ว่าง → สรุปทั้ง PR |
| ready_for_review หลังรีวิวด้วย label แล้ว | รีวิวทั้ง PR อีกรอบ (OCR บังคับ; inline ซ้ำบรรทัดเดิมไม่โพสต์ซ้ำ) | สรุปถึง head แล้ว = ข้าม, ไม่งั้น comment อัปเดต |
| reopened | รีวิวทั้ง PR (OCR บังคับ) | body ว่าง + head ใหม่ → comment อัปเดต, ไม่งั้นข้าม |
| แก้ body (edited) | ไม่รัน | ลบ description ทิ้งจนว่าง → สรุป/อัปเดต, เขียน description → ข้าม (comment หยุดอัปเดต) |
| PR sync/release (head `main`/`develop`/`release/*`) | ข้าม 0 นาที (ยกเว้นสั่งด้วย label) | ข้าม 0 นาที (ยกเว้น label) |
| PR ของ bot (Dependabot, agent) | รีวิวเหมือน PR คน (ใช้ OIDC token ได้ถ้าตั้ง `OPENCODE_CLIENT_ID`; แบบ secret ต้องมี Dependabot secret ไม่งั้น fail ที่ Sign in to OpenCode) | เหมือน PR คน (ไม่มี key → ข้าม) |
| PR จาก fork | fail ที่ Sign in to OpenCode (fork ไม่ได้ OIDC token และ secret) | ข้าม (ไม่มี credential) |
| diff ว่าง (มีแต่ empty commit, ไม่ใช่ draft) | รันแต่ไม่มีอะไรให้รีวิว (ยังไม่ได้ทดสอบกรณีนี้; ใน flow ClickUp เป็น draft จึงข้าม) | ข้าม 0 นาที |
| label อื่นที่ไม่ใช่ `ai-review` | ข้าม 0 นาที | ข้าม 0 นาที |

ผลทดสอบ comment แยกต่อ push (playground #16, 1 พ.ย. 2026 เวลาไทย) https://github.com/jaiieth/ai-pr-review-playground/pull/16
- 17:18 เปิด PR 3 commit → comment สรุปทั้ง PR (marker `2772caa`) 0:48
- 17:20 push 2 commit → comment ใหม่ `🔄 อัปเดต PR (OpenCode): 2772caa..e457fb7` รายการ 2 commit + สรุปเฉพาะ 2 commit นั้น 0:36
- 17:22 push 1 commit → comment ใหม่ `e457fb7..c301ac9` (ต่อจาก marker ของ comment อัปเดตก่อนหน้า) 0:31
- comment สรุปแรกไม่ถูกแก้ (updated_at เท่าเดิม) / OCR รอบ `e457fb7` ถูก cancel เพราะ push ใหม่มาระหว่างรัน (concurrency ต่อ PR) แล้วรอบ `c301ac9` รีวิว checkpoint `2772caa..c301ac9` (รวม commit ของ push ที่ถูก cancel) 2:15

หมายเหตุ: PR ที่เปิดไว้ก่อนแก้ workflow จะใช้ไฟล์ workflow จาก merge ref เดิมจนกว่าจะมี push ใหม่ (playground: #9 ติด label ครั้งแรกแล้ว trigger ใหม่ของ OpenCode ยังไม่ทำงาน)

## Flow ClickUp → GitHub
| ขั้น | OCR | Summary |
|---|---|---|
| ClickUp เปิด **draft** PR (empty first commit, body ว่าง) | ข้าม 0 นาที | ข้าม 0 นาที |
| dev push WIP เข้า draft | ข้าม 0 นาที | ข้าม 0 นาที |
| task ย้ายไป **Review** → bot ติด label `ai-review` | รีวิวทั้ง PR | body ว่าง → สรุปทั้ง PR |
| แก้ตาม review (push, ยังเป็น draft) | ข้าม | comment "อัปเดต PR" ใหม่ |
| ย้ายกลับ Review → bot เอา label ออกแล้วติดใหม่ | รีวิวเฉพาะ commit ใหม่ | สรุปถึง head แล้ว → ข้าม |
| QA ผ่าน → `gh pr ready` | รีวิวทั้ง PR อีกรอบ (inline ซ้ำไม่โพสต์ซ้ำ) | สรุปถึง head แล้ว → ข้าม |
| push แก้หลัง ready | รีวิวเฉพาะ commit ใหม่ | comment "อัปเดต PR" ใหม่ |
| PR sync/release (`develop`→`main`, `release/*`) | ข้าม | ข้าม |

## ค่าใช้จ่าย (ผลจาก playground, ดูตัวเลขละเอียดใน actions-cost.md)
ทดสอบบน playground (public repo จึงไม่ถูกเก็บเงินจริง ตัวเลขนาทีด้านล่างคือนาทีที่จะถูกคิดใน private repo ซึ่ง GitHub ปัดขึ้นเป็นนาทีต่อ job) วันอาทิตย์ 1 พ.ย. 2026 ราว 16:37–16:46 น. (เวลาไทย, off-peak)

| งาน | runner | เวลา job | นาทีที่คิดเงิน | ค่า Actions |
|---|---|---|---|---|
| OCR รีวิวทั้ง PR (รอบแรก) | ubuntu-latest | 2:05–2:35 | 3 | $0.018 |
| OCR push ใหม่ (checkpoint, เฉพาะ commit ใหม่) | ubuntu-latest | 1:24 | 2 | $0.012 |
| OCR push หลัง merge base เข้า branch (base เปลี่ยน → กลับไปรีวิวทั้ง PR) | ubuntu-latest | 2:01 | 3 | $0.018 |
| OCR ติด label ใหม่โดยไม่มี commit ใหม่ (no-op) | ubuntu-latest | 0:12 | 1 | $0.006 |
| OpenCode สรุป PR ที่ไม่มี description (ทั้ง PR) | ubuntu-slim | 0:33–0:54 | 1 | $0.002 |
| OpenCode comment อัปเดต (1–2 commit) | ubuntu-slim | 0:31–0:36 | 1 | $0.002 |
| OCR หลัง force-push (checkpoint หาไม่เจอ → ทั้ง PR) | ubuntu-latest | 2:32 | 3 | $0.018 |
| ready หลัง label (รีวิวทั้ง PR อีกรอบ) | ubuntu-latest | ~2:05–2:35 | 3 | $0.018 |
| OpenCode เจอ description / สรุปถึง head แล้ว → ข้าม | ubuntu-slim | 0:05–0:07 | 1 | $0.002 |
| draft / empty commit / sync PR → ข้ามระดับ job | – | 0 | 0 | $0 |

- ราคา: Linux 2-core $0.006/นาที, 1-core (slim) $0.002/นาที https://docs.github.com/en/billing/reference/actions-runner-pricing
- ค่า token (OpenCode Go): จาก benchmark ก่อนหน้า OCR deepseek+thinking รีวิวทั้ง PR ≈ $0.031–0.038 ต่อรอบ (repo สังเคราะห์, off-peak) ช่วง peak วันธรรมดา (08–11 และ 13–17 น. เวลาไทย) แพงขึ้น 2 เท่า https://opencode.ai/docs/go/ ส่วนรอบ checkpoint ยังไม่ได้วัด token แยก แต่ diff เล็กกว่าจึงควรถูกกว่า
- ตัวอย่างต่อ PR (รีวิวเต็ม 1 รอบ + แก้ 2 รอบ + สรุป): Actions 3+2+2 นาที (2-core) + 1 นาที (slim) ≈ $0.044

## ปรับกฎรีวิว
- แก้ `.opencodereview/rule.json`: `exclude` = glob ไฟล์ที่ไม่ต้องรีวิว, `rules` = คำสั่งรีวิว (`merge_system_rule: true` จึงใช้กฎ TypeScript/Prisma ในตัวของ OCR ด้วย)
- ทดสอบโดยไม่เสีย token: `ocr rules check <file>` และ `ocr review --preview --from <base> --to HEAD`

## ⚠️ muse-spark-1.3-contributor: ห้ามใช้กับโค้ด ERP จริง
ตาม https://opencode.ai/docs/go/#privacy โมเดลนี้มี Training = Yes และ Retention = Not ZDR (ราคาถูกเพราะยอมให้นำ prompt/completion ไป train) **ปิด toggle "Allow paid endpoints that train on request data"** และอย่าตั้ง `OCR_MODEL` หรือ `OPENCODE_MODEL` เป็น muse
