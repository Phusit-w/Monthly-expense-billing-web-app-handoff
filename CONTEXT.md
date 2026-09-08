# Expense Billing

This context covers expense documents created, reviewed, printed, and downloaded by authenticated users.

## Language

**Saved Billing Form**:
An FA017 or FA018 expense document whose current values have been persisted and can be reopened from the records list.
_Avoid_: Draft form, temporary form

**Billing PDF**:
A PDF generated on demand from the latest persisted version of a Saved Billing Form, using the approved on-screen form as its visual reference.
_Avoid_: Screenshot PDF, draft PDF

**Print fallback**:
The browser print dialog used to print a Saved Billing Form or save it as PDF when direct Billing PDF generation is unavailable.

