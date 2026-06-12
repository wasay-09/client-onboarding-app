# FBSI Onboarding Portal — What It Does

(Plain-language overview for the client)

## The big picture

A client picks their plan type and is guided through one continuous questionnaire that adapts to their answers. They review and agree to the Service Agreement partway through, finish the remaining details, and download a complete onboarding summary at the end. They are never asked the same thing twice.

## The flow, step by step

### 1. Choose a plan type
Five options: 401(k), 403(b), 457(b), SIMPLE IRA, Solo 401(k). The rest of the questionnaire tailors itself to this choice.

### 2. Company & plan basics
Employer information and plan identification (name, effective date, trustee, etc.).

### 3. Review & agree to the Service Agreement (401(k), 403(b), and Solo 401(k) only)
The agreement appears as text on screen, already filled in with the company and plan details just entered, including a fee-schedule summary. The client reads it and checks "I have read and agree." They can optionally download a PDF copy. This comes before the detailed questions — matching how onboarding actually works (sign first, then configure).

### 4. Plan design details (401(k) and 403(b))
Eligibility, vesting, employer match, profit sharing, loans, distributions, safe harbor, and automatic enrollment. Questions appear only when they apply — e.g. match details show only if there's an employer match; the auto-enrollment setup appears only if the client elects it.

### 5. The operational setup forms (combined into the same flow)
Depending on the plan, the client also completes:
- Plan Setup – recordkeeping details (assets, participant count, prior provider if converting)
- Plan Contacts – primary contact, additional contacts and their roles, trustees
- Payroll – pay frequency, divisions, and ACH funding details
- Financial Advisor – advisor firm and how the advisor is paid
- Fund Setup – the investment lineup, default fund, and broker-of-record if applicable
- Automatic Enrollment – only if elected earlier
- Employee Census – employee data in FBSI's required format (employees can be typed in or the file submitted separately)

Solo 401(k) gets a lighter set (no payroll/census/auto-enrollment, since it's owner-only). 457(b) and SIMPLE IRA stay short — basics and contacts only.

### 6. Finish & download
The client downloads a single Onboarding Summary containing everything they entered,eturn the signed agreement, submit census and funding, schedule the onboarding call).

## Two principles built into every screen

- **Ask once.** Details like company name, EIN, plan name, advisor, and payroll contact nd reused everywhere they're needed — never re-asked on a later form.
- **Only what's relevant.** The questionnaire hides anything that doesn't apply to the selected plan or the client's earlier answers, so each client sees the shortest correct path.

---
**Status:** All changes are applied and verified — production build passes, automated chypes, and the code is lint-clean. One small item worth a quick client confirmation:we treat the questionnaire's "Broker" as the financial advisor (standard, but flag it in case a plan has a separate broker-of-record, which the Fund Setup section already captures).
