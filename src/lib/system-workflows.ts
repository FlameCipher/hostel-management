import type { GuideRole, GuideTopic } from "./system-guide";
import type { HostelStaffRole } from "./staff-navigation-policy";

type Workflow = GuideTopic & { id: string; match: RegExp; ownerOnly?: boolean; tenantBody?: string; tenantHref?: string; tenantAction?: string; caretakerBody?: string; caretakerHref?: string };

/** Instructions checked against the actual pages/actions, never live hostel records.
 * Keep this catalogue with the corresponding feature when its workflow changes. */
export const systemWorkflows: Workflow[] = [
  { id: "student-checkout", title: "Check out a student and release the room", terms: "vacated vacate move out moving out remove tenant student resident checkout clearance vacant empty kuhama amehama chumba",
    match: /\b(?:vacat(?:e|ed|ing)|mov(?:e|ed|ing) out|kuhama|amehama|check[ -]?out|clearance)\b|\b(?:make|mark|free|release|clear|empty)\b.*\b(?:room|bed|space|vacant)\b|\b(?:remove|clear)\b.*\b(?:students?|tenants?|residents?|someone|occupants?)\b/,
    body: "To record a student moving out and release their room:\n1. Open Check-in / Check-out, search for the student or room, then select View on the correct active stay.\n2. Select Check out. Enter the actual checkout date, room condition and the condition of recorded student property and hostel assets.\n3. Review the rent treatment: keep current semester rent, pro-rate using actual days, or use Owner/Admin custom agreed rent. A rent change requires a reason.\n4. Review the final balance. Record any payment actually received. Only Owner/Admin can clear with an outstanding balance, with an override reason; this does not erase the debt.\n5. Review and press Complete checkout. The system closes the stay, marks the student checked out, clears applicable break holds and updates room availability. The clearance page then opens.\nAn ordinary room becomes Vacant only when no active occupants or holds remain. A shared room may remain partly occupied; Maintenance and Inactive rooms stay unavailable. Keep the student and payment history—deleting a student or manually marking an occupied room vacant is not the move-out process. This is separate from a visitor leaving or a student reporting a temporary outing. No checkout has been completed by this answer.",
    href: "/occupancy", action: "Open Check-in / Check-out",
    tenantBody: "For a permanent move-out, contact management to confirm your departure, review rent and any balance, inspect the room and belongings, and complete your student checkout. A temporary outing or visitor checkout does not end your tenancy. You cannot complete management clearance yourself.", tenantHref: "/tenant/contact",
    caretakerBody: "A student permanently moving out needs a management checkout. Verify the departure and room/item condition with management, then have the owner, admin or manager open the active stay under Check-in / Check-out and complete clearance. Caretaker access cannot approve student checkout or balance overrides.", caretakerHref: "/occupancy" },
  { id: "room-transfer", title: "Transfer a student to another room", terms: "transfer change move room bedsitter single rent review history",
    match: /\b(?:transfer|switch rooms?|change rooms?|room change|mov(?:e|ed|ing).{0,35}(?:room|bedsitter)|room.{0,20}(?:transfer|another))\b/,
    body: "Open Check-in / Check-out, find the student's active stay, select View, then Transfer. Choose the destination room, actual transfer date and rent treatment; review availability, rent changes and the reason before confirming. Use Transfer review for existing room history and charge evidence. Payments and prior room history are retained. Moving rooms is different from final checkout.", href: "/occupancy", action: "Open stays and transfers" },
  { id: "holiday-break", title: "Record a holiday and returning student", terms: "holiday break return belongings storage reservation semester away",
    match: /\b(?:holidays?|break period|break decision|returning student|returning after (?:holiday|break)|storage charge|reserve.{0,15}room)\b/,
    body: "In Check-in / Check-out, create the break period, then Record break decision for the active student. Record whether they will return and whether belongings stay. The configured storage policy determines the break charge. A returning resident with no belongings can retain a free reservation; belongings can incur a storage charge. Confirm actual return in the break register. A resident who is not returning must complete normal checkout and room clearance.", href: "/occupancy", action: "Review holiday decisions" },
  { id: "payment-correction", title: "Correct or reverse a payment", terms: "wrong incorrect payment amount reverse receipt correction duplicate",
    match: /\b(?:correct|reverse|reversal|wrong|mistake|incorrect|duplicate)\b.*\b(?:payment|receipt|paid|amount)\b|\b(?:payment|receipt)\b.*\b(?:correct|reverse|wrong|mistake|incorrect|duplicate)\b/,
    body: "Owner/Admin opens Payments, identifies the exact original payment and reviews its receipt, student, charge and reference. Use the available correction or reversal action, enter the reason and review its financial effect before confirming. Corrections preserve the original audit history and link any replacement payment. Do not add a second payment to hide a mistake. Recheck the student's balance and receipt afterwards.", href: "/payments", action: "Review payment to correct", ownerOnly: true },
  { id: "student-allocation", title: "Allocate a paid student and check in", terms: "allocate allocation checkin check in assign bed room paid",
    match: /\b(?:allocat\w*|check[ -]?in|assign.{0,20}(?:room|bed))\b/,
    body: "Open Check-in / Check-out → Allocate paid student. Select the existing student, the correct semester and an available room, then record the actual check-in details and condition. Review the required recorded payment, room capacity and rent before confirming. Admission and payment come before allocation; a booking enquiry alone does not occupy a room.", href: "/occupancy/check-in", action: "Allocate paid student" },
  { id: "staff-access", title: "Add staff and control permissions", terms: "caretaker security staff user role permissions administrator owner onboard password login",
    match: /\b(?:staff|caretaker|security (?:account|staff)|permissions?|user role|administrator|owner login|owner sign in)\b/,
    body: "The hostel owner or authorised admin opens Users & Permissions and creates an individual staff account. Enter the person's actual details, choose the appropriate role and active status, and complete password setup privately. Caretaker/security can use an enrolled phone number without email; record duty hours and time zone where applicable. Staff use Staff sign in on their own hostel website. Owners/admins use Owner / administrator sign in with their registered email. Managers and caretakers cannot create staff or grant themselves permissions.", href: "/users", action: "Users & Permissions", ownerOnly: true },
  { id: "registration-approval", title: "Approve an existing student's portal request", terms: "approve registration pending activate existing tenant identity access",
    match: /\b(?:approv\w*|pending|existing)\b.*\b(?:registration|student|tenant|account|access)\b|\bregistration\b.*\bapprov\w*\b/,
    body: "Owner/Admin opens Tenant Registration, independently verifies the requester using the resident and contact already on file, and selects the matching existing student. The name, phone and current room must match before activation. A request remains pending until approved, expires after seven days, and does not create a second tenancy. Existing or blocked access cannot be overwritten through a new request.", href: "/students/registrations", action: "Review student requests", ownerOnly: true },
  { id: "student-admission", title: "Admit or import students", terms: "admit admission add register student tenant resident import csv onboard",
    match: /\b(?:admi\w*|onboard|enrol\w*|register|add|create|import|csv)\b.*\b(?:students?|tenants?|residents?)\b|\b(?:student|tenant)\b.*\b(?:admission|import|registration)\b/,
    body: "Owner/Admin opens Students → Add student and enters the actual student and guardian details, active semester and room type. Review the generated rent charge, record the initial payment actually received, then allocate the room. Import CSV is available for batch records after checking duplicates and required fields. An admitted student still needs approved portal access to sign in. Managers and caretakers cannot admit or import new students.", href: "/students", action: "Open student register", ownerOnly: true,
    tenantBody: "Existing residents use their hostel website → Student sign in → Request student access. Enter your recorded name, phone and current room and choose a password privately. Owner/Admin independently verifies and approves your request before sign-in is enabled. This does not book a new room or create a second tenancy. A new resident must first be admitted by the owner or authorised admin.", tenantHref: "/tenant/register", tenantAction: "Request student access" },
  { id: "portal-invitations", title: "Invite students to activate their accounts", terms: "invitation invite activation link portal email mobile",
    match: /\b(?:invit\w*|activation link|activate.{0,15}portal)\b/,
    body: "Owner/Admin opens Automatic account invitations to review eligible admitted residents and the invitation delivery state. Check the registered contact and selected recipients before issuing or retrying an invitation. Residents without usable email have a separate mobile onboarding view. An invitation only activates the matched existing account; it does not book a room or admit an unknown resident. Sent, delivered and activated are different states.", href: "/communications/invitations", action: "Review account invitations", ownerOnly: true },
  { id: "student-records", title: "Review student records and portal access", terms: "student tenant register edit details archive delete duplicate merge portal disable password",
    match: /\b(?:student|tenant|resident)\b.*\b(?:record|details|edit|delet\w*|archiv\w*|merge|duplicate|password|disable|access)\b|\b(?:edit|delete|archive|merge|disable|reset)\b.*\b(?:student|tenant|resident)\b/,
    body: "Open Students and identify the exact resident before editing. Owner/Admin controls identity, sign-in contacts, status and portal access. For duplicate or erroneous records, review the dedicated merge/delete confirmation and its linked records first. A genuine move-out uses Check-in / Check-out, preserving the financial and occupancy history. Passwords cannot be read back; use the protected access/reset controls after identity verification.", href: "/students", action: "Review student record" },
  { id: "guardian-details", title: "Review guardian and contact corrections", terms: "guardian parent contact phone details update request",
    match: /\b(?:guardian|parent|detail update|contact correction|update request)\b/,
    body: "Open the Guardian contact register to review linked student and guardian contacts. Detail update requests are reviewed separately against the existing record before approval. Verify identities and the proposed contact change; a submitted request alone must not replace approved details.", href: "/students/guardians", action: "Open guardian contacts" },
  { id: "rent-adjustment", title: "Review or correct semester rent", terms: "rent charge adjustment prorate actual days agreed monthly correction semester rate",
    match: /\b(?:rent|charge|rate)\b.*\b(?:adjust|correct|change|recalculat\w*|prorat\w*|agreed|review)\b|\b(?:adjust|correct|change|recalculat\w*|prorat\w*)\b.*\b(?:rent|charge|rate)\b/,
    body: "Find the exact student stay in Check-in / Check-out and open its rent/history review. Use the dedicated transfer, monthly correction or checkout workflow that matches the event. Review the semester, effective dates, rate, previous payments and reason before confirming an allowed adjustment. A room-type price is not proof of a student's agreed rent, and an adjustment does not create a payment.", href: "/occupancy", action: "Review stay and rent" },
  { id: "payment-recording", title: "Record payments and issue receipts", terms: "payment pay receipt rent mpesa bank cash reference",
    match: /\b(?:payments?|receipts?|record.{0,15}rent|pay rent)\b/,
    body: "Open Payments → Record payment, select the correct student and existing charge, and enter the amount actually received, payment date, method and reference. Review the remaining balance before confirming. The system records the payment and provides a receipt; delivery status must be checked separately. In this assistant, Record payment opens the same protected review workspace. No money is collected or payment recorded by an explanation.", href: "/payments", action: "Open payments" },
  { id: "reconciliation", title: "Reconcile bank or M-Pesa records", terms: "reconcile reconciliation mpesa statement import bank transaction",
    match: /\b(?:reconcil\w*|mpesa statement|m-pesa statement|bank statement)\b/,
    body: "Open M-Pesa reconciliation, import the supported statement and review each transaction against the recorded payment, student and reference. Resolve unmatched or ambiguous entries through the protected review controls. A statement import is not evidence that every transaction has been correctly allocated.", href: "/payments/reconciliation", action: "Open reconciliation" },
  { id: "financial-audit", title: "Review financial integrity", terms: "financial integrity audit discrepancy ledger mismatch",
    match: /\b(?:financial integrity|financial audit|ledger audit|financial discrepancy)\b/,
    body: "Open Financial integrity to review recorded linkage, currency and balance exceptions. Inspect the underlying student, charge and payment evidence before using any permitted correction workflow. A clean automated check is not independent proof that cash or a bank payment was received.", href: "/payments/audit", action: "Review financial integrity" },
  { id: "room-register", title: "Manage rooms and availability", terms: "room capacity status maintenance inactive vacancy vacant category sharing",
    match: /\b(?:rooms?|beds?)\b.*\b(?:add|edit|creat\w*|manage|capacity|status|maintenance|inactive|availability|vacan\w*)\b|\b(?:add|edit|creat\w*|manage|maintenance)\b.*\brooms?\b/,
    body: "Open Rooms to review room numbers, property, room type, capacity and availability. Use Add room or Edit for configuration. Actual occupancy and retained break reservations determine occupied spaces. Use student checkout to release a vacated bed; do not clear an occupied room by changing its status. Maintenance and Inactive rooms remain unavailable until management reviews them.", href: "/rooms", action: "Open rooms" },
  { id: "booking-review", title: "Review booking requests", terms: "booking enquiry reservation applicant confirm reject",
    match: /\b(?:bookings?|enquir\w*|reservation requests?)\b/,
    body: "Open Bookings and select the relevant request/status. Verify the applicant and requested accommodation, then use the available review controls. Confirm capacity and actual payment before admission and allocation. A booking request is an enquiry, not an activated student account or confirmed room occupancy.", href: "/bookings", action: "Review bookings" },
  { id: "semester-calendar", title: "Configure semesters", terms: "semester academic term dates activate close calendar",
    match: /\b(?:semester|academic term|term dates)\b/,
    body: "Open Semesters to create and review the academic period, start/end dates and status. Use the available activation/closing controls after checking affected students and charges. Admission and rent must refer to the intended semester; changing a calendar does not by itself prove a student has moved out.", href: "/semesters", action: "Open semesters" },
  { id: "student-property", title: "Record student belongings", terms: "student belongings property laptop items valuables inventory",
    match: /\b(?:belongings|student property|student items|laptop|valuables)\b/,
    body: "Open Student Property to add or review belongings linked to the correct student and stay. Record the identifying details and condition. At checkout, review each recorded item's condition in the checkout inspection. This inventory does not replace physical verification or guarantee security of goods.", href: "/student-property", action: "Open student property" },
  { id: "hostel-assets", title: "Maintain hostel furniture and assets", terms: "assets furniture inventory bed mattress damage repair",
    match: /\b(?:assets?|furniture|mattress|hostel inventory)\b/,
    body: "Open Hostel Assets to add or edit hostel-owned items, their room, quantity and condition. Review damaged or missing items against inspection evidence. The checkout form includes active assets from the student's room so their condition can be recorded during clearance.", href: "/assets", action: "Open hostel assets" },
  { id: "expenses", title: "Record hostel expenses", terms: "expense cost expenditure spending purchase bill",
    match: /\b(?:expenses?|expenditure|spending|purchase|bills?)\b/,
    body: "Open Expenses → Add expense. Enter the actual expense details using the form, confirm the amount and date against supporting evidence, and save. Review the expense register and reports afterwards. A student rent payment belongs in Payments, not Expenses.", href: "/expenses", action: "Open expenses" },
  { id: "reports", title: "View and export reports", terms: "reports export print income occupancy outstanding balance totals",
    match: /\b(?:reports?|export|print report)\b/,
    body: "Open Reports, select the relevant reporting filters and period, then review the figures before using the available export or print option. Outstanding charges, money received and room occupancy describe different things; check the labels and dates. Reports use hostel records and do not independently reconcile a bank balance.", href: "/reports", action: "Open reports" },
  { id: "announcements", title: "Send a notice to all or selected students", terms: "notice announce announcement communications broadcast selected all message send",
    match: /\b(?:announc\w*|broadcast|notice|communications|send.{0,50}(?:all|selected|many)|message.{0,30}(?:all|selected))\b/,
    body: "Open Communications, choose all eligible recipients or selected students, draft the notice and review the audience and channel before sending. The assistant can prepare a supported notice for review, but nothing is sent until the authorised confirmation. Check delivery results; opening a WhatsApp draft does not mean it was sent.", href: "/communications", action: "Open communications" },
  { id: "reminders", title: "Prepare rent and holiday reminders", terms: "reminder arrears balance holiday reminder notification",
    match: /\b(?:reminders?|notifications?)\b/,
    body: "Open Reminders, select the available reminder type and intended students, and review the content and recipient information before creating or sending it. Check the channel's queue and delivery status afterwards. A reminder does not change a student's balance, holiday decision or hostel access.", href: "/notifications", action: "Open reminders" },
  { id: "website", title: "Manage the public hostel website", terms: "website publish profile address contact description domain photos gallery",
    match: /\b(?:website|publish|profile|domain|photos?|pictures?|gallery)\b/,
    body: "Open My Website to update the hostel's verified public description, location, contacts and room photographs. Label photos as full building exterior, compound or room interior; room interiors belong to the correct room type. Review publication readiness and the actual public hostel address. Use real hostel photos and check the published page after saving.", href: "/website", action: "Open My Website" },
  { id: "vacancy-card", title: "Share a vacancy card", terms: "vacancy card poster marketing share whatsapp",
    match: /\b(?:vacancy card|vacancy poster|marketing card)\b/,
    body: "Open Vacancy Card, review the hostel name, website, accommodation details and availability, then use the available sharing controls. Confirm real room availability before promising a place. Sharing the card does not reserve a bed or create a booking.", href: "/vacancy-card", action: "Open vacancy card" },
  { id: "hostel-setup", title: "Set up a hostel property", terms: "setup set up property accommodation types configuration publish",
    match: /\b(?:setup|set up (?:my |the |a )?hostel|create.{0,15}property|accommodation types)\b/,
    body: "Open Hostel Setup to configure the hostel identity, property details, operating currency and accommodation types, then review website readiness. Add actual rooms and authorised staff before using the hostel operationally. Check names, contacts, capacity and rates against your own property records.", href: "/setup", action: "Open hostel setup" },
  { id: "settings", title: "Change hostel settings and room rates", terms: "settings currency price rates contact configuration",
    match: /\b(?:settings|currency|room rates|room prices|accommodation rates)\b/,
    body: "Open Settings to review organisation details, operating currency, property details and accommodation rates. Use only the permitted controls and review the effects before saving. Configured room-type rates do not automatically establish an existing student's individually agreed charge; use the relevant rent-review workflow for an existing account.", href: "/settings", action: "Open settings" },
  { id: "healthfix", title: "Check system health", terms: "healthfix health repair error failure diagnostics",
    match: /\b(?:healthfix|system health|self repair|diagnostics|system error)\b/,
    body: "Owner/Admin opens HealthFix to review module checks, daily runs and repair history. Review the proposed effect before approving an available controlled repair. Automated checks do not confirm phone answering, physical security staffing, payment receipt or external message delivery.", href: "/healthfix", action: "Open HealthFix", ownerOnly: true },
  { id: "gate-readiness", title: "Verify gate and emergency readiness", terms: "gate readiness emergency phone call test responder duty push drill",
    match: /\b(?:gate readiness|emergency.{0,30}(?:test|readiness)|test.{0,20}(?:phone|call|notification)|responder|duty hours)\b/,
    body: "Owner/Admin opens Gate readiness to review staff accounts, portal activation, emergency contacts and device readiness. Make real calls to the hostel emergency numbers and record the actual answer/result. Set up the designated responders and their devices, then use the staff notification test and supervised SOS test as provided. Do not record an unmade call or treat a successful software check as staffed emergency coverage.", href: "/gate-readiness", action: "Review gate readiness", ownerOnly: true },
  { id: "student-outings", title: "Report outings, late returns and arrivals", terms: "outing going out late return arrival back outside movement",
    match: /\b(?:outings?|going out|late return|late notice|(?:be|am|will be) late|return.{0,10}late|arriv\w*|come back|coming back|movements?)\b/,
    body: "Open Student outings & late returns to review reported departures, expected returns and late notices. Acknowledge a late notice after reviewing it and verify actual arrival using the gate controls. Student reports do not provide continuous tracking or prove physical whereabouts, and a late notice does not itself guarantee gate admission.", href: "/outings", action: "Open outings and returns", caretakerHref: "/outings",
    tenantBody: "Open Going out & returning, record when you leave and your expected return, post a late notice if plans change, and report your return when you arrive. Security records gate verification separately. These are updates you provide, not automatic tracking. A late notice is not guaranteed permission to enter; contact the gate directly if needed.", tenantHref: "/tenant/movements" },
  { id: "sos", title: "Use emergency calling and hostel SOS", terms: "sos danger emergency safety alert panic help",
    match: /\b(?:sos|danger|emergency|panic|safety alert)\b/,
    body: "Open Student SOS to review alerts your role is permitted to see. Contact the student and designated responder, record acknowledgement and response information, and resolve only after actual follow-up. Emergency calls and the hostel's SOS feature are separate; availability and the configured pilot/readiness controls determine whether SOS can be used. A notification does not prove that help has arrived.", href: "/safety", action: "Open emergency and SOS", caretakerHref: "/safety",
    tenantBody: "For immediate danger, use the emergency call buttons and contact a real responder. Open Emergency and SOS information for the hostel's available SOS controls. If SOS is enabled, follow the confirmation form and provide the requested details; a saved alert is not proof that help has arrived. If it is not enabled, use calling and direct contact.", tenantHref: "/tenant/safety" },
  { id: "class-timetable", title: "Manage a student's class timetable", terms: "class lesson timetable schedule reminder course study",
    match: /\b(?:timetables?|class(?:es)?|lessons?|courses?|study)\b/,
    body: "Students manage their own private class timetable in their portal: add a lesson, day, start/end time, venue and reminder preferences, then edit or remove lessons when plans change. Compatible device notifications require permission and setup. The timetable is personal planning, not attendance or proof of a student's location. Staff should direct the student to their own portal.", href: "/students", action: "Open student register",
    tenantBody: "Open My class timetable. Add the lesson title, day, start/end times and venue, and choose its reminder settings. Use Edit to change a class or remove an old one. Check the displayed time zone and enable device notifications if you want supported reminders. The timetable is personal planning, not university attendance or location tracking.", tenantHref: "/tenant/timetable", caretakerHref: "/occupancy" },
  { id: "dashboard", title: "Understand the dashboard", terms: "dashboard overview occupancy income balances summary",
    match: /\bdashboard\b/,
    body: "Open Dashboard for the hostel's current record summary. Follow each card into its register to inspect the underlying room, student, payment or balance records. The recorded date and scope matter; a dashboard total is not independent proof of physical occupancy or bank reconciliation.", href: "/dashboard", action: "Open dashboard" },
  { id: "visitor-gate", title: "Register and verify a visitor", terms: "visitor guest checkin checkout gate arrival departure",
    match: /\b(?:visitor|guest|wageni)\b/,
    body: "Open Visitor gate and identify the expected visitor and host. Verify identity and actual arrival before Verify check-in. When the visitor actually leaves, use Verify check-out. An overdue departure means checkout was not recorded; it does not prove the visitor is still inside. Visitor checkout does not end the student's tenancy.", href: "/visitors", action: "Open visitor gate", caretakerHref: "/visitors",
    tenantBody: "Open My visitors and register the actual visitor's details, your current room and expected arrival/departure times. Gate staff verify actual entry and exit. You may cancel before check-in, but cannot check a visitor in or out yourself.", tenantHref: "/tenant/visitors", tenantAction: "Open My visitors" },
  { id: "whatsapp", title: "Use WhatsApp delivery and drafts", terms: "whatsapp business sender queue send draft delivery",
    match: /\b(?:whatsapp|whats app|business sender)\b/,
    body: "Open WhatsApp to review queued drafts and delivery information. A manual draft requires you to open WhatsApp and press Send; opening it alone is not confirmed sending. Automated sending requires an approved connected business sender and eligible recipients. Review the intended message and recipients before sending or retrying. Sent, delivered and read are different states.", href: "/communications/whatsapp", action: "Open WhatsApp" },
  { id: "private-messages", title: "Read and reply to private messages", terms: "inbox conversation complaint message reply owner management",
    match: /\b(?:inbox|conversation|complaint|reply|message.{0,20}(?:owner|management)|contact management)\b/,
    body: "Open Student Inbox to read or start a private conversation with an eligible activated tenant. Review the exact recipient, subject and message before sending. Students reply through Contact management. Use Communications for a notice to all or selected recipients.", href: "/communications/inbox", action: "Open Student Inbox",
    tenantBody: "Open Contact management to write a subject and message or reply in your private conversation. Check My messages for responses. For immediate danger use emergency calling; inbox messages are not guaranteed to be monitored continuously.", tenantHref: "/tenant/contact", tenantAction: "Contact management" },
  { id: "account-password", title: "Sign in and recover account access", terms: "password forgot reset change login signin sign in account show hide",
    match: /\b(?:password|sign in|login|my account)\b/,
    body: "Owners/admins use Owner / administrator sign in with their registered email. Staff use Staff sign in with the details enrolled by the owner/admin. Open My Account to change your own password; Show/Hide only reveals the value you are typing, not an existing stored password. For a forgotten password use the registered-email recovery path. Phone-only staff should ask the owner/admin to verify identity and reset access. Never put a password in this chat.", href: "/account", action: "Open My Account", caretakerHref: "/account",
    tenantBody: "Use Student sign in on your hostel website after owner/admin approval. For a forgotten password, use recovery with the email registered on your account. If you cannot access it, ask management to verify your identity and reset access. Show/Hide only reveals what you are typing; stored passwords cannot be read back. Never put a password in this chat.", tenantHref: "/tenant/login", tenantAction: "Open Student sign in" },
  { id: "install-app", title: "Install the hostel app", terms: "install app android iphone ios home screen download icon",
    match: /\b(?:install|download|home screen|app icon)\b/,
    body: "Open Install App on your own hostel website. On Android use Chrome's Install app or Add to Home screen. On iPhone/iPad use Safari → Share → Add to Home Screen and enable Open as Web App if offered. Confirm on your device, then use your existing approved account. Notification permission is separate. This is the hostel's installable web app; current records require internet.", href: "/install", action: "Install hostel app", tenantHref: "/install", caretakerHref: "/install" },
  { id: "student-terms", title: "Review accommodation terms", terms: "terms agreement policy acceptance rules consent",
    match: /\b(?:terms|agreement|policy|rules|consent)\b/,
    body: "Open Student Terms to review published accommodation terms and recorded acceptance. Students review and accept the terms through their own portal. Use the hostel's approved wording; do not infer new penalties, rent amounts or acceptance from an assistant conversation.", href: "/student-terms", action: "Review accommodation terms", tenantHref: "/tenant/terms", caretakerHref: "/occupancy" },
  { id: "assistant-help", title: "Use the system assistant", terms: "assistant functions capabilities system guide what can do modules",
    match: /\b(?:assistant|system functions|every function|all functions|system guide|modules|what can you do)\b/,
    body: "Ask for instructions for check-in, student checkout, transfers, holiday decisions, payments and corrections, student and staff onboarding, rooms, bookings, contacts, messages, reports, safety or settings. Ask a specific room/student/period question for supported live record answers. Register a student and Record payment open protected review workspaces for authorised users. Other changes use the linked page and its confirmation. An explanation never means a change has already been made.", href: "/assistant", action: "System assistant", tenantHref: "/tenant/assistant", caretakerHref: "/assistant" },
];

const instruction = /\b(?:how (?:do|does|can|should|to|will)|where (?:do|can|should)|show me how|steps?|procedure|explain|help me|guide me|why (?:can.t|cannot|won.t))\b|^(?:please\s+)?(?:open|manage|set up|configure|add|edit|change|remove|delete|archive|correct|reverse|transfer|move|vacate|clear|check out|check in|allocate|approve|enable|disable|invite|test|record)\b/;

export function systemWorkflowIntent(question: string): string | null {
  const q = question.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  if (!q || q.length > 1200) return null;
  // Preserve existing confirmed admission/payment workspaces for direct commands.
  if (/^(?:please\s+)?(?:add|register|enrol|enroll|create)\s+(?:(?:a|this|new)\s+){0,3}(?:student|tenant|resident)\b/.test(q) || /^(?:please\s+)?(?:record|add|post|enter|allocate|register)\s+(?:(?:a|this|new)\s+){0,3}(?:payment|rent payment|mpesa payment|bank payment|cash payment)\b/.test(q)) return null;
  if (!instruction.test(q) && !/\b(?:has vacated|have vacated|amehama|tenant moved out|student moved out)\b/.test(q) && !/^(?:what can you do|student checkout|tenant checkout|move out|checkout procedure)\??$/.test(q)) return null;
  if (/\b(?:duplicate|merge)\b/.test(q) && /\b(?:students?|tenants?|residents?)\b/.test(q)) return "student-records";
  if (/\b(?:room|accommodation) (?:rates?|prices?)\b/.test(q)) return "settings";
  // Visitor gate actions and short outings never end a resident's tenancy.
  const visitor = /\b(?:visitor|guest|wageni)\b/.test(q);
  const excluded = new Set(visitor ? ["student-checkout", "student-allocation"] : []);
  // Specific topics precede broad matches (payment, website, semester, staff).
  const priority = ["gate-readiness", "vacancy-card", "financial-audit", "reconciliation", "sos", "class-timetable", "visitor-gate", "student-property", "guardian-details", "payment-correction", "student-checkout", "room-transfer", "holiday-break", "student-allocation", "student-outings", "install-app", "whatsapp", "private-messages"];
  const ordered = [...priority.map(id => systemWorkflows.find(w => w.id === id)!), ...systemWorkflows.filter(w => !priority.includes(w.id))];
  return ordered.find(w => !excluded.has(w.id) && w.match.test(q))?.id ?? null;
}

export function workflowGuide(role: GuideRole): GuideTopic[] {
  return systemWorkflows.flatMap(w => {
    if (role === "PUBLIC") return [];
    if (role === "TENANT" && !w.tenantHref) return [];
    if (role === "CARETAKER" && !w.caretakerHref) return [];
    const { id, title, terms, body, href, action } = w;
    return [{ id, title, terms, body: role === "TENANT" ? w.tenantBody ?? body : role === "CARETAKER" ? w.caretakerBody ?? body : body,
      href: role === "TENANT" ? w.tenantHref! : role === "CARETAKER" ? w.caretakerHref! : href, action: role === "TENANT" ? w.tenantAction ?? action : action }];
  });
}

export function answerSystemWorkflow(question: string, role: GuideRole, staffRole?: HostelStaffRole) {
  const id = systemWorkflowIntent(question);
  if (!id) return null;
  const entry = systemWorkflows.find(w => w.id === id)!;
  const topic = workflowGuide(role).find(w => w.id === id);
  if (!topic || (entry.ownerOnly && role !== "TENANT" && staffRole !== "OWNER" && staffRole !== "ADMIN")) return {
    mode: "guide" as const, text: entry.ownerOnly ? "Only the hostel owner or an authorised administrator may perform this action. Ask them to review it from their admin account. Your account permissions have not changed." : "This is a hostel management task. Contact your hostel owner or authorised management to review and complete it.",
    links: role === "TENANT" ? [{ title: "Contact management", href: "/tenant/contact", action: "Contact management" }] : [],
  };
  return { mode: "guide" as const, text: topic.body, links: [{ title: topic.title, href: topic.href, action: role === "TENANT" && topic.href === "/tenant/contact" ? "Contact management" : topic.action }] };
}
