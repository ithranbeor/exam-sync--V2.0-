---
description: 
auto_execution_mode: 3
---

Key UX / UI Issues & Opportunities
Fragmented visual design
LoginFaculty
, 
LoginAdmin
, 
ResetPassword
, dashboards all use different custom CSS files and patterns.
Color, typography, border radius, spacing, and card styling aren’t unified.
index.css
 and 
App.css
 still carry Vite starter assumptions (centered #root, max-width: 1280px) that likely fight with full-screen dashboard layouts.
Duplicated layout patterns
Both 
DashboardFaculty
 and 
DashboardAdmin
 implement:
Sidebar with logo and items.
Content header with page title.
Time/date display.
Mobile hamburger/backdrop behavior.
But they do it independently, so every change must be duplicated and can drift visually.
Navigation clarity
Faculty dashboard title is just derived from activeMenu key names (exam-Date, plot-Schedule, etc.) → user-facing labels aren’t always human-friendly.
Some menu keys are mixed-case (Request, Room-Management, User Management key vs label) which can lead to subtle inconsistencies in labels and titles.
Admin and faculty menus use different wording and structure, even where capabilities overlap (e.g., exam schedule, set modality).
Inconsistent feedback & error patterns
Logins use inline error-text message areas.
ResetPassword
 uses toast notifications (react-toastify).
Other flows (notifications, scheduling, CRUD) are likely using ad-hoc patterns (modals, inline messages, etc.).
There is no single, predictable pattern for:
Success vs failure.
Long-running actions (loading states).
Empty state messaging (e.g., no exams yet, no notifications).
Accessibility gaps
Visual-only feedback (colors, icons) without clear ARIA roles.
Custom controls (password visibility icon, modern checkbox, sidebars) without obvious keyboard & screen-reader handling.
Contrast, focus states, and semantic headings are not centrally considered.
Complexity in single components
DashboardFaculty
 is a large monolith: state for user, roles, notifications, time, mobile behavior, sidebar, content switching, logout modal, etc., all in one file.
This makes it harder to iterate on UI/UX without risking regressions.
Underused design tooling
You have tailwindcss and 
tailwindcss/vite
 in dependencies, but the current styles are traditional CSS files, not utility or component-based styling.
This is an opportunity to move towards a more systematic design system instead of one-off CSS.
UX Improvement Concept
“ExamSync Workspace 2.0: A unified, role-aware workspace with a shared design system.”

Core idea:

Single, consistent application shell:
One layout component that standardizes:
Sidebar behavior (desktop hover, mobile slide-in).
Header (title, date/time, breadcrumb).
Global actions (notifications, profile, logout).
Faculty and admin views become configurations of the same shell, not separate implementations.
Design system & tokens
Define reusable tokens:
Colors (primary, accent, success, danger, background, surface).
Typography scale (H1–H6, body, caption).
Spacing, radius, elevation (card, modal).
Implement a small component library:
Button, Input, Select, Card, PageHeader, Sidebar, Modal, Badge, EmptyState.
Use those everywhere: logins, reset, dashboards, management screens.
Unify auth & entry experience
One cohesive “ExamSync Access” experience:
Shared visual style + layout for 
LoginFaculty
, 
LoginAdmin
, 
ResetPassword
.
Clear explanation of roles and how they affect what you see.
Same interaction model (button states, errors, password visibility, etc.).
Role-based information architecture
For each role (proctor, scheduler, dean, bayanihan leader, admin), define:
Top tasks (e.g., “see today’s exams”, “review requests”, “manage buildings/rooms”).
Dedicated sections in the sidebar and dashboard for those tasks.
Dashboards emphasize:
“Today / This week” at a glance.
Pending actions (e.g. open requests, missing proctor availability).
Quick shortcuts into key screens.
Consistent feedback system
Standardize:
Inline validation (per-field errors).
Page-level alerts (info/success/error banners).
Toasts only for short-lived confirmations.
Provide clear empty states and loading states for lists and tables.
Multi-phase Workflow
Below is a practical multi-phase plan you can actually execute without halting delivery.

Phase 1 – UX Audit & Strategy Alignment
Goals
Make the current UX fully explicit and agree on priorities (which flows to fix first).
Tasks
Inventory screens:
Map all routes and states: logins, reset, faculty dashboard sections, admin sections, notifications, proctor flows, CRUD screens.
Task-centric review:
For each role, list the top 3–5 tasks and trace them through the UI.
Identify problem themes:
Inconsistencies (styles, labels, flows).
Bottlenecks (too many clicks, confusing navigation).
Define UX goals:
e.g. “Faculty can see today’s assignments in 1 click”, “Admin can reach any management entity in 2 clicks”.
Deliverables
Simple site map.
Role–task matrix (role vs primary flows).
Short UX issues list sorted by impact.
Phase 2 – Design System Foundations
Goals
Create a minimal but solid design system and layout foundation.
Tasks
Define tokens:
Colors, typography, spacing, radii, shadows.
Create base components (start small, e.g. in src/ui):
Button, TextInput, PasswordInput, Checkbox, Card, PageHeader, Modal.
Standardize layout shell:
AppShell with:
Sidebar (collapsed/expanded, mobile behavior).
Header with title and optional actions.
Content area with consistent padding and background.
Clean up global CSS:
Remove Vite template constraints (max-width, forced centering).
Ensure body and #root support full viewport layout and proper scroll.
Deliverables
Documented token file(s).
Reusable layout + base components ready for adoption.
Phase 3 – Unify Authentication & Reset Flows
Goals
Make the entry experience consistent and professional.
Tasks
Visual alignment:
Apply the design system to 
LoginFaculty
, 
LoginAdmin
, 
ResetPassword
:
Shared logo placement, typography, buttons, input styling.
UX alignment:
Consistent error messaging model.
Same loading indicators and button states.
Consistent copy and titles (e.g. “Sign in to ExamSync”, “Reset your password”).
Optional: converge to a single login screen with “Sign in as Admin” / “Sign in as Faculty” toggle, clearly explained.
Deliverables
Updated auth screens using shared components & styles.
Document describing validations and error message patterns.
Phase 4 – Shared Dashboard Shell & Navigation
Goals
Replace duplicated dashboard layouts with a common shell and improve navigation semantics.
Tasks
Extract shared shell:
Factor common elements from 
DashboardFaculty
 and 
DashboardAdmin
 into:
DashboardShell (sidebar, header, main, logout modal).
Sidebar and SidebarItem components.
Normalize menu models:
Represent menu items as configuration objects (with label, path/key, icon, access role).
Ensure labels are user-facing (no internal-case weirdness).
Improve titles & breadcrumbing:
Use human-readable page titles in headers.
Optional: add simple breadcrumbs for nested management screens.
Deliverables
Both dashboards using the same shell.
Single place to adjust sidebar behavior or styling.
Phase 5 – Refactor Key Feature Screens with the Design System
Focus first on the highest-impact flows for each role.

Goals
Apply the new UI language to core work screens and reduce one-off CSS.
Tasks
Choose priority screens:
For example:
Proctor: ProctorExamDate, ProctorSetAvailability, ProctorViewExam, ProctorAttendance.
Scheduler: SchedulerAvailability, ScheduleViewer.
Admin: Colleges, Programs, Rooms, ExamPeriod, UserManagement.
Standardize structures:
List/table patterns (headers, filters, empty states, pagination).
Forms (labels, inline validation, required indicators, button areas).
Modals / dialogs (consistent look and behavior).
Gradual CSS consolidation:
Replace bespoke styles with design-system classes or components.
Delete old CSS only when a screen is fully migrated.
Deliverables
A set of “golden path” screens that exemplify the new UX.
Reduced CSS sprawl and clearer component boundaries.
Phase 6 – Accessibility, Responsiveness & Performance Polish
Goals
Ensure the refined UI works well for all users on all devices and feels fast.
Tasks
Accessibility pass:
Check color contrast.
Add ARIA roles where needed (modals, menus, toasts).
Ensure keyboard navigation (tab order, focus outlines).
Responsive refinements:
Test main screens on key breakpoints (mobile, tablet, desktop, large desktop).
Adjust layout in AppShell, cards, and tables to adapt gracefully.
Performance UX:
Use skeletons/spinners where relevant.
Avoid long “Loading...” text-only states without context.
Consider lazy-loading heavy sections/routes.
Deliverables
Documented accessibility checklist for future features.
Finalized responsive layout rules.
Phase 7 – Measurement & Continuous Improvement (Optional but Recommended)
Goals
Make UX improvements measurable and iterative.
Tasks
Add lightweight analytics / event tracking for:
Login success/failure (without storing sensitive data).
Time-to-first-task from dashboard.
Usage of core flows (exam scheduling, proctor availability).
Establish a basic feedback loop:
Periodic check-ins with real faculty/admin users.
Capture qualitative feedback on new UI.
Deliverables
Simple metrics dashboard or logs.
Backlog of future UX enhancements driven by data