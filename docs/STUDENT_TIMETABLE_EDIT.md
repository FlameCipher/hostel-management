# MMAMBUGUA Hostel — student-owned timetable corrections

This adds an **Edit class details** action beside every existing weekly class in the resident's private portal at `/tenant/timetable`. Students can change class name, course code, lecture hall, weekday, start/end time, lead time and whether reminders are enabled.

The update changes **the same** StudentLesson record. It never generates another class, a new booking, a payment or an inferred attendance/whereabouts event. Gate staff, caretakers and management cannot read or modify private class schedules through this feature.

## Security and accounting

- The existing signed tenant session is revalidated against the Student table and the student's current active hostel occupancy.
- `Student` is locked inside a Prisma database transaction before any change, serializing concurrent schedule updates for the same resident.
- The specific lesson must belong to that student, hostel organization, and their current property. Disabled/removed/foreign records cannot be edited.
- The same strict class durations, time format, weekday, reminder options, duplicate detection and overlap protection used in registration also apply during editing. Invalid/unchanged submissions do not create an audit trail.
- Successful edits create a metadata-only `STUDENT_LESSON_UPDATED` audit event specifying changed field names, not lecture titles, venue, student details or whereabouts.
- Previously **queued and failed** class notification jobs for that student's class are cancelled to avoid sending an obsolete schedule after an edit. The existing worker may enqueue new reminders for the updated schedule. Notifications already delivered or in flight cannot be recalled.
- No database schema migration, rent changes, new student account or physical-location capture.

## Verification

`npm run test:timetable-edit` covers same-ID updates, no duplicate, conflict cases, invalid values, foreign/disabled sessions and no room, no-op behavior, scoped cancellation of stale reminders, and UI/action authorization. It is part of `npm run build`.

A real student's own Android/iPhone test is still necessary to verify time input, changed displayed times, and optional delivery through their configured push subscription. A READY build does not prove push arrival or university attendance.
