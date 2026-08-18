# Verification Record — RiderUnmasked

This document is written for security-program reviewers, trust & safety teams, and other parties evaluating the provenance and intent of this repository.

## Project identity

- **Research target:** Glovo Rider Android application
- **Package:** `com.logistics.rider.glovo`
- **Analyzed version:** v4.2614.1 (build 1210)
- **Research type:** mobile application security review and reverse engineering
- **Public repository:** `SeniorStackOverflow/RiderUnmasked`
- **Repository visibility:** public

## Responsible disclosure record

The following dates are maintained by the researcher as the disclosure record:

| Event | Date |
|---|---:|
| Research / report completed | **2026-03-15** |
| Report sent privately to Glovo | **2026-03-18** |
| Company awareness date recorded by researcher | **2026-03-20** |
| Findings remediated by | **2026-04-02** |
| Public GitHub repository created | **2026-04-08** |

The repository was therefore created **after the stated remediation date**, consistent with a disclosure-first, publication-after-remediation workflow.

## What can be independently checked on GitHub

A reviewer can independently verify through GitHub metadata and repository history that:

1. this repository is owned by the `SeniorStackOverflow` account;
2. the repository was created on **2026-04-08**;
3. the repository contains the technical report and the corresponding interactive presentation;
4. the public repository appeared after the stated **2026-04-02** remediation date;
5. later documentation commits explicitly record the responsible-disclosure timeline rather than attempting to backdate Git history.

GitHub metadata by itself does **not** prove private correspondence with the vendor. The disclosure dates above are researcher-provided statements. Private correspondence, ticket identifiers, or vendor messages should be evaluated separately if an authorized reviewer requests corroboration.

## Research boundaries and intent

This repository documents security research, not an attempt to provide an active attack service. The project states that production systems were not targeted for destructive modification or disruption. Public materials are intended to document application architecture, security observations, methodology, and remediation history.

The repository is **not affiliated with, endorsed by, or maintained by Glovo**.

## Materials available to a reviewer

- [`README.md`](./README.md) — project overview and disclosure timeline
- [`glovo-rider-analysis.md`](./glovo-rider-analysis.md) — technical analysis
- [`index.html`](./index.html) — interactive presentation
- [`SECURITY.md`](./SECURITY.md) — responsible-research and reporting policy

## Evidence handling

Private vendor communications are intentionally not published merely to make the repository look more convincing. If such evidence is needed for a legitimate verification process, the appropriate approach is to provide **redacted correspondence directly to the authorized reviewer**, preserving timestamps and sender/domain information while removing unrelated personal or confidential data.

## Reviewer summary

**Claimed sequence:** research completed → vendor privately notified → vendor awareness recorded → remediation → public repository.

**Independently visible sequence:** GitHub repository creation occurred on **2026-04-08**, after the stated remediation date of **2026-04-02**.
