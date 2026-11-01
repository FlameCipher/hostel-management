# Rent payment demands and agreed dates

The payment charge picker is searchable by student or room and separates names, charge details and outstanding amounts. It requires an explicit selection. The communication centre also shows rooms, overdue amounts and agreement status, with a dedicated rent-demand workflow.

Management can record or clear an agreed payment date at `/reports/arrears`. An approved date excludes the current tenant from demands through that date in the property's time zone. The following day, the tenant becomes eligible again only if rent remains overdue. Agreements do not change charges or payments. Changes require an active owner, administrator or manager, a reason, confirmation and the current agreement version, and produce an audit record.

Eligibility is recalculated before notice creation and external delivery. Paid accounts, future charges, active agreements and accounts requiring ledger review are excluded. Previously queued balance reminders and demands are checked again. Generic balance broadcasts redirect to the demand workflow so recipient exclusions cannot be bypassed by that notice type.

The default formal demand contains the verified overdue amount and due date, asks for immediate payment or contact with management, and warns of recovery escalation under the accommodation agreement and applicable law. No percentage penalty, ledger fee or access denial is introduced. Existing signed hostel terms contain no 5% or 10% penalty.

Messages are private per recipient. Portal publication, prepared WhatsApp copies, email attempts and provider-confirmed delivery remain distinct. External WhatsApp delivery still requires a configured business sender. Deploying this change does not send notices, record real agreements or change automation settings.

Validation: TypeScript, focused ESLint, arrears policy tests, communications tests, WhatsApp tests, Pesapal tests and isolated PGlite arrears integration tests. Integration coverage includes agreement authorization and tenant scope, stale edits, fresh and queued demand exclusions, expiry, clearing and audit records. No live payment or tenant message was sent for validation.
