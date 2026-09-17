# Project Card

This context catalogs past/current proposal projects from the company's `PS` network share into searchable summary records, so a project can be found by what it is and what it cost without browsing folders or opening files by hand.

## Language

**Project Card**:
A single searchable record summarizing one top-level project folder from the `PS` share: client, project name, description, budget, year, and a path back to the folder. One folder always produces exactly one card, even when the folder contains multiple proposal drafts internally.
_Avoid_: Project record, entry, listing

**Client**:
The organization a project was done for (e.g. MEA, PEA, MOF, NT, NBTC), derived from the project's position in the share's folder hierarchy.
_Avoid_: Customer, organization

**Description**:
A short, AI-generated summary of what a project does, written in both Thai and English so a query in either language can match. Editable by hand after generation. Blank (not an error) until an AI provider is approved and wired up — the crawler ships with one disabled by default, same fail-closed convention as SOC's document analysis.
_Avoid_: Summary, abstract

**Budget**:
A project's monetary value, AI-extracted from its proposal/contract documents, taken from the winning or final proposal when a folder holds several drafts. Carries an `unverified` flag until a person confirms it, and is never presented as authoritative before that.
_Avoid_: Cost, price, value

**Folder Path**:
The UNC path back to a project's folder on the `PS` share, kept on the Project Card so a user can navigate to the original files by hand. Search inside the folder's files is explicitly out of scope (see ADR 0003).
_Avoid_: Location, share path
