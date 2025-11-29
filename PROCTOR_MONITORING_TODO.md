# 📋 Proctor Monitoring System - Implementation Checklist

## 🎯 Priority 1: Backend Foundation (Django)

### 1.1 Database Models
- [ ] **ExamOTP Model**
  - Fields: `schedule_id`, `otp_code`, `assigned_proctor_id`, `exam_start_time`, `exam_end_time`, `validity_status`, `created_at`
  - OTP Format: `[Building][Room]-[CourseCode]-[RandomCode]` (e.g., `09306-IT114-X5P9K`)
  - Auto-generate on schedule approval

- [ ] **Attendance Model**
  - Fields: `proctor_id`, `schedule_id`, `otp_code_used`, `timestamp`, `role` (assigned/sub), `remarks`, `status` (present/absent)
  - Link to ExamSchedule and Proctor

- [ ] **LogActivity Model** (Audit Trail)
  - Fields: `user_id`, `action`, `schedule_id`, `timestamp`, `details`
  - Track: attendance confirmations, substitutions, OTP generation

### 1.2 API Endpoints

#### OTP Management
- [ ] `POST /api/generate-otp/` - Generate OTPs for approved schedules
- [ ] `GET /api/otp/{schedule_id}/` - Get OTP for specific schedule (role-based access)
- [ ] `GET /api/otps/` - List all OTPs (Scheduler/Admin only)

#### Attendance Management
- [ ] `POST /api/verify-otp/` - Verify OTP and check proctor assignment
  - Returns: `{valid: bool, is_assigned: bool, requires_substitution: bool, exam_details: {...}}`
- [ ] `POST /api/confirm-attendance/` - Submit attendance confirmation
  - Body: `{schedule_id, otp_code, remarks, role}`
  - Validation: Time window check, OTP validity, attendance lock after exam end
- [ ] `GET /api/attendance/{schedule_id}/` - Get attendance status
- [ ] `GET /api/attendance/` - List all attendance records (Scheduler/Admin)

#### Schedule Management
- [ ] `GET /api/proctor-schedules/` - Get proctor's assigned schedules
- [ ] `GET /api/all-schedules/` - Get all approved schedules (for substitution)
- [ ] `PATCH /api/schedule/{id}/status/` - Update schedule status (Dean approval)

### 1.3 Business Logic

- [ ] **OTP Generation Logic**
  - Trigger on schedule approval (status: "pending" → "active")
  - Generate unique random code (5-6 alphanumeric)
  - Format: `{Building}{Room}-{CourseCode}-{RandomCode}`
  - Store in ExamOTP table

- [ ] **OTP Validation Logic**
  - Check OTP exists and is active
  - Verify current time is within exam slot
  - Check if logged-in user matches assigned proctor
  - Return appropriate response for substitution flow

- [ ] **Attendance Lock Logic**
  - Prevent attendance confirmation after `exam_end_time`
  - Return error: `{"error": "Attendance is closed"}`

- [ ] **Time Validation**
  - Use Django `timezone.now()` for server-side time
  - Check: `exam_start_time <= current_time <= exam_end_time`

### 1.4 Permissions & Authentication

- [ ] **Role-Based Permissions**
  - `IsAuthenticated` - All endpoints
  - `IsProctor` - View assigned schedules, confirm attendance
  - `IsDean` - Approve schedules, view all schedules
  - `IsScheduler` - Generate OTPs, view attendance dashboard
  - `IsAdmin` - Full access

- [ ] **JWT Authentication**
  - Token-based auth for React Native
  - Token refresh mechanism

---

## 🎯 Priority 2: Frontend Functionality

### 2.1 ProctorMonitoring Component

- [ ] **OTP Generation**
  - Connect "CREATE BUTTON" to `POST /api/generate-otp/`
  - Show loading state during generation
  - Display generated OTPs in the OTP field
  - Show success/error messages

- [ ] **OTP Display**
  - Fetch OTPs for approved schedules
  - Display in format: `09306-IT114-X5P9K`
  - Only show to authorized users (role-based)

- [ ] **Status Indicators**
  - Show which schedules have OTPs generated
  - Visual indicator (icon/badge) for OTP status

### 2.2 ProctorAttendance Component

#### Modal Enhancements
- [ ] **OTP Validation Flow**
  - On OTP input, call `POST /api/verify-otp/`
  - Show validation feedback:
    - ✅ Valid + Assigned → Enable submit
    - ⚠️ Valid + Not Assigned → Show substitution prompt
    - ❌ Invalid/Expired → Show error message

- [ ] **Substitution Flow**
  - If OTP valid but proctor not assigned:
    - Show message: "Not assigned. Act as a substitute?"
    - Make remarks field **required**
    - Update submit button text: "Confirm as Substitute"

- [ ] **Time Validation**
  - Check if current time is within exam window
  - Show warning if outside time window
  - Disable submission if after exam end time

- [ ] **Form Validation**
  - OTP required (cannot be empty)
  - Remarks required for substitutions
  - Show validation errors inline

- [ ] **Submission Handling**
  - Call `POST /api/confirm-attendance/`
  - Show loading state
  - Handle success: Close modal, show success message, refresh list
  - Handle errors: Display error message, keep modal open

#### "All Exams" Section
- [ ] **Make Cards Clickable**
  - Add click handler to "All Exams" cards
  - Open same modal for substitution
  - Pre-fill exam details
  - Show "Substitution Mode" indicator

- [ ] **Substitution Indicators**
  - Visual distinction for exams available for substitution
  - Show assigned proctor name prominently

#### Status Updates
- [ ] **Real-time Status**
  - Show attendance status after confirmation
  - Color-coded indicators:
    - 🟩 Green = Present
    - 🟥 Red = Absent
    - 🟡 Yellow = Pending
  - Update card appearance after submission

- [ ] **Attendance History**
  - Show which exams have been confirmed
  - Disable clickable state for already-confirmed exams
  - Show confirmation timestamp

### 2.3 Error Handling & User Feedback

- [ ] **Toast Notifications**
  - Success: "Attendance confirmed successfully"
  - Error: "Invalid OTP code" / "Attendance is closed" / "Network error"
  - Warning: "You are not assigned to this exam. Proceed as substitute?"

- [ ] **Loading States**
  - Button loading spinners
  - Disable inputs during API calls
  - Skeleton loaders for data fetching

- [ ] **Empty States**
  - "No assigned exams" message
  - "No OTPs generated yet" message
  - Helpful guidance text

---

## 🎯 Priority 3: Advanced Features

### 3.1 Dashboard & Monitoring (Scheduler/Admin View)

- [ ] **Attendance Dashboard**
  - Table/grid view of all schedules
  - Color-coded status (Green/Red)
  - Filter by: Date, Building, Proctor, Status
  - Search functionality

- [ ] **Substitution Tracking**
  - Label substitute proctors: "Sub – [Name]"
  - Show original proctor name
  - Display substitution remarks

- [ ] **Real-time Updates**
  - Poll API for attendance updates
  - Or implement WebSockets for live updates
  - Auto-refresh every 30 seconds (optional)

- [ ] **Export Functionality**
  - Export attendance report (CSV/PDF)
  - Include: Date, Time, Course, Proctor, Status, Remarks

### 3.2 Notifications (Optional)

- [ ] **Email/SMS Notifications**
  - Notify proctor when schedule is approved
  - Remind proctor before exam time
  - Alert scheduler when attendance is confirmed
  - Use Django-Q, Celery, or Twilio

### 3.3 Audit Trail

- [ ] **Activity Log Display**
  - Show who confirmed attendance and when
  - Track all substitutions
  - Display in admin dashboard

---

## 🎯 Priority 4: Edge Cases & Validation

### 4.1 Time-Based Validations
- [ ] Prevent attendance before exam start time
- [ ] Lock attendance after exam end time
- [ ] Handle timezone differences (use server time)
- [ ] Show countdown timer (optional)

### 4.2 OTP Security
- [ ] OTP expiration (if needed)
- [ ] Rate limiting on OTP verification attempts
- [ ] Log failed OTP attempts

### 4.3 Data Integrity
- [ ] Prevent duplicate attendance confirmations
- [ ] Handle concurrent submissions
- [ ] Validate proctor assignment before confirmation
- [ ] Check schedule status (only "active" schedules)

### 4.4 Error Scenarios
- [ ] Network failures (retry mechanism)
- [ ] Invalid OTP format
- [ ] Expired schedules
- [ ] Deleted schedules
- [ ] Proctor account disabled

---

## 🎯 Priority 5: UI/UX Polish

### 5.1 Visual Enhancements
- [ ] Add icons for status indicators
- [ ] Loading animations
- [ ] Smooth transitions
- [ ] Success/error animations

### 5.2 Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] ARIA labels
- [ ] Focus management

### 5.3 Mobile Responsiveness
- [ ] Test on mobile devices
- [ ] Optimize modal for small screens
- [ ] Touch-friendly buttons
- [ ] Responsive grid layouts

---

## 🔄 Integration Checklist

### Backend → Frontend Integration Points

1. **ProctorMonitoring**
   - [ ] Fetch approved schedules: `GET /api/schedules/?status=active`
   - [ ] Generate OTPs: `POST /api/generate-otp/` with schedule IDs
   - [ ] Display OTPs: `GET /api/otp/{schedule_id}/`

2. **ProctorAttendance**
   - [ ] Fetch assigned schedules: `GET /api/proctor-schedules/`
   - [ ] Fetch all schedules: `GET /api/all-schedules/`
   - [ ] Verify OTP: `POST /api/verify-otp/`
   - [ ] Submit attendance: `POST /api/confirm-attendance/`
   - [ ] Check attendance status: `GET /api/attendance/{schedule_id}/`

### State Management
- [ ] Implement state management (Context API / Redux)
- [ ] Cache schedule data
- [ ] Handle authentication state
- [ ] Manage loading/error states globally

---

## 📝 Testing Requirements

### Unit Tests
- [ ] OTP generation logic
- [ ] OTP validation logic
- [ ] Time validation
- [ ] Attendance submission

### Integration Tests
- [ ] Full attendance flow (OTP → Verification → Confirmation)
- [ ] Substitution flow
- [ ] Error handling

### E2E Tests
- [ ] Proctor confirms attendance
- [ ] Proctor substitutes for another
- [ ] Scheduler generates OTPs
- [ ] Admin views attendance dashboard

---

## 📚 Documentation

- [ ] API documentation (Swagger/OpenAPI)
- [ ] Component documentation
- [ ] User guide for proctors
- [ ] Admin guide for schedulers

---

## 🚀 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] CORS settings for React Native
- [ ] Error logging (Sentry/LogRocket)
- [ ] Performance monitoring
- [ ] Backup strategy

---

## Summary

**Total Tasks: ~60+ items**

**Estimated Timeline:**
- Priority 1 (Backend): 2-3 weeks
- Priority 2 (Frontend): 1-2 weeks
- Priority 3 (Advanced): 1 week
- Priority 4 (Edge Cases): 3-5 days
- Priority 5 (Polish): 2-3 days

**Critical Path:**
1. Database models → API endpoints → Frontend integration → Testing

**Quick Wins (Can be done first):**
- Make "All Exams" cards clickable
- Add substitution flow in modal
- Add toast notifications
- Add loading states

