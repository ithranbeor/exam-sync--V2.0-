import React, { useState, useEffect, useCallback } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../lib/apiClient';
import '../styles/P_ProctorAttendance.css';
import {
  FaCheckCircle, FaClock, FaHistory, FaClipboardCheck,
  FaExchangeAlt, FaSearch, FaShieldAlt, FaTimes, FaKey,
  FaCalendarAlt, FaUserTie, FaChalkboardTeacher,
  FaDoorOpen, FaBuilding, FaExclamationTriangle,
  FaChevronDown, FaChevronUp,
} from 'react-icons/fa';

interface UserProps {
  user: { user_id: number; email: string; first_name?: string; last_name?: string } | null;
}

interface ExamDetails {
  id: number;
  course_id: string;
  subject: string;
  section_name: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  building_name: string;
  room_id: string;
  instructor_name?: string;
  assigned_proctor?: string;
  status?: string;
}

type OtpStatus = 'idle' | 'valid-assigned' | 'valid-not-assigned' | 'invalid';
type Tab = 'ongoing' | 'upcoming' | 'completed';

const ProctorAttendance: React.FC<UserProps> = ({ user }) => {
  const [selectedExam, setSelectedExam]             = useState<ExamDetails | null>(null);
  const [showModal, setShowModal]                   = useState(false);
  const [isSubstitutionMode, setIsSubstitutionMode] = useState(false);
  const [otpCode, setOtpCode]                       = useState('');
  const [remarks, setRemarks]                       = useState('');
  const [otpStatus, setOtpStatus]                   = useState<OtpStatus>('idle');
  const [ongoingExams, setOngoingExams]             = useState<ExamDetails[]>([]);
  const [upcomingExams, setUpcomingExams]           = useState<ExamDetails[]>([]);
  const [completedExams, setCompletedExams]         = useState<ExamDetails[]>([]);
  const [allExams, setAllExams]                     = useState<ExamDetails[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [verifyingOtp, setVerifyingOtp]             = useState(false);
  const [submittingAttendance, setSubmitting]        = useState(false);
  const [_verificationData, setVerificationData]    = useState<any>(null);
  const [activeTab, setActiveTab]                   = useState<Tab>('ongoing');
  const [searchTerm, setSearchTerm]                 = useState('');
  // Collapsible substitution section — collapsed by default, resets on tab change
  const [showSubstitution, setShowSubstitution]     = useState(false);

  // Close substitution accordion whenever tab changes
  useEffect(() => { setShowSubstitution(false); }, [activeTab]);

  const fetchAssigned = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const { data } = await api.get(`/proctor-assigned-exams/${user.user_id}/`);
      setOngoingExams(data.ongoing || []);
      setUpcomingExams(data.upcoming || []);
      setCompletedExams(data.completed || []);
    } catch { toast.error('Failed to load assigned exams'); }
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const { data } = await api.get('/all-exams-for-substitution/', { params: { user_id: user.user_id } });
      setAllExams(data || []);
    } catch { toast.error('Failed to load substitution exams'); }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchAssigned(), fetchAll()]);
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [fetchAssigned, fetchAll]);

  const fmt = (ts?: string) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
    } catch { return '—'; }
  };

  const filter = (list: ExamDetails[]) =>
    !searchTerm.trim() ? list : list.filter(e =>
      [e.course_id, e.subject, e.section_name, e.building_name, e.room_id, e.instructor_name ?? '']
        .some(v => v.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  const openModal = (exam: ExamDetails, isSub = false) => {
    setSelectedExam(exam); setIsSubstitutionMode(isSub);
    setShowModal(true); setOtpCode(''); setRemarks(''); setOtpStatus('idle');
  };
  const closeModal = () => {
    setShowModal(false); setSelectedExam(null); setIsSubstitutionMode(false);
    setOtpCode(''); setRemarks(''); setOtpStatus('idle');
  };

  const handleVerify = async () => {
    if (!otpCode.trim() || !user?.user_id) return;
    setVerifyingOtp(true);
    try {
      const res = await api.post('/verify-otp/', { otp_code: otpCode.trim(), user_id: user.user_id });
      const { valid, verification_status, message, exam_schedule_id, ...rest } = res.data;
      if (valid) { setOtpStatus(verification_status); setVerificationData({ exam_schedule_id, ...rest }); }
      else { setOtpStatus('invalid'); toast.error(message || 'Invalid OTP code'); }
    } catch (e: any) { setOtpStatus('invalid'); toast.error(e.response?.data?.error || 'Failed to verify OTP'); }
    finally { setVerifyingOtp(false); }
  };

  const handleSubmit = async () => {
    if (!user?.user_id || !otpCode.trim()) { toast.error('Missing required information'); return; }
    const role = (isSubstitutionMode || otpStatus === 'valid-not-assigned') ? 'sub' : 'assigned';
    if (role === 'sub' && !remarks.trim()) { toast.error('Remarks are required for substitution'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/submit-proctor-attendance/', {
        otp_code: otpCode.trim(), user_id: user.user_id,
        remarks: remarks.trim() || undefined, role,
      });
      toast.success(res.data.message || 'Attendance recorded successfully');
      if (res.data.status === 'late') toast.warning('Marked as LATE — arrived more than 7 min after start time', { autoClose: 5000 });
      await Promise.all([fetchAssigned(), fetchAll()]);
      closeModal();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to submit attendance'); }
    finally { setSubmitting(false); }
  };

  const isSubRole  = isSubstitutionMode || otpStatus === 'valid-not-assigned';
  const canSubmit  = otpStatus.startsWith('valid') && !(isSubRole && !remarks.trim());

  const currentList = {
    ongoing: filter(ongoingExams),
    upcoming: filter(upcomingExams),
    completed: filter(completedExams),
  }[activeTab];

  const filteredSubExams = filter(allExams);

  const StatusBadge = ({ status }: { status?: string }) => {
    if (!status) return null;
    const m: Record<string, [string, string]> = {
      confirmed:  ['Confirmed',  'pa-badge--confirmed'],
      late:       ['Late',       'pa-badge--late'],
      substitute: ['Substitute', 'pa-badge--sub'],
      pending:    ['Ongoing',    'pa-badge--ongoing'],
      absent:     ['Absent',     'pa-badge--absent'],
      upcoming:   ['Upcoming',   'pa-badge--upcoming'],
    };
    const entry = m[status];
    return entry ? <span className={`pa-badge ${entry[1]}`}>{entry[0]}</span> : null;
  };

  const ExamCard = ({ exam, isSub = false }: { exam: ExamDetails; isSub?: boolean }) => {
    const locked = ['confirmed', 'late', 'substitute'].includes(exam.status ?? '');
    const badgeStatus = exam.status ?? (activeTab === 'upcoming' ? 'upcoming' : 'pending');

    return (
      <div
        className={`pa-card ${isSub ? 'pa-card--sub' : 'pa-card--assigned'} ${locked ? 'pa-card--locked' : 'pa-card--clickable'}`}
        onClick={() => !locked && activeTab !== 'upcoming' && openModal(exam, isSub)}
        role={!locked && activeTab !== 'upcoming' ? 'button' : undefined}
        tabIndex={!locked && activeTab !== 'upcoming' ? 0 : -1}
        onKeyDown={e => !locked && activeTab !== 'upcoming' && e.key === 'Enter' && openModal(exam, isSub)}
      >
        <div className="pa-card__top">
          <div className="pa-card__pills">
            <span className="pa-card__course">{exam.course_id}</span>
            {isSub && <span className="pa-card__sub-pill"><FaExchangeAlt style={{ fontSize: 8 }} /> Sub</span>}
          </div>
          <StatusBadge status={badgeStatus} />
        </div>

        <div className="pa-card__body">
          <h4 className="pa-card__title">{exam.subject}</h4>
          <p className="pa-card__section">{exam.section_name}</p>
        </div>

        <div className="pa-card__details">
          <div className="pa-card__row">
            <FaCalendarAlt className="pa-card__row-icon" />
            <span>{exam.exam_date}</span>
            <span className="pa-card__dot">·</span>
            <span>{fmt(exam.exam_start_time)} – {fmt(exam.exam_end_time)}</span>
          </div>
          <div className="pa-card__row">
            <FaBuilding className="pa-card__row-icon" />
            <span>{exam.building_name}</span>
            <span className="pa-card__dot">·</span>
            <FaDoorOpen className="pa-card__row-icon" />
            <span>Room {exam.room_id}</span>
          </div>
          {exam.instructor_name && (
            <div className="pa-card__row">
              <FaChalkboardTeacher className="pa-card__row-icon" />
              <span>{exam.instructor_name}</span>
            </div>
          )}
          {isSub && exam.assigned_proctor && (
            <div className="pa-card__row pa-card__row--warn">
              <FaUserTie className="pa-card__row-icon" />
              <span>Replacing <strong>{exam.assigned_proctor}</strong></span>
            </div>
          )}
        </div>

        <div className={`pa-card__footer ${locked ? 'pa-card__footer--done' : isSub ? 'pa-card__footer--sub' : activeTab === 'upcoming' ? 'pa-card__footer--muted' : 'pa-card__footer--action'}`}>
          {locked
            ? <><FaCheckCircle /> Attendance recorded</>
            : activeTab === 'upcoming'
            ? 'Not yet open for check-in'
            : isSub
            ? 'Tap to substitute as proctor →'
            : 'Tap to confirm proctorship →'
          }
        </div>
      </div>
    );
  };

  return (
    <div className="pa-page">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* ── Header ── */}
      <div className="pa-page-header">
        <div className="pa-page-header__left">
          <div className="pa-page-icon"><FaShieldAlt /></div>
          <div className="pa-page-title">
            <h1>Proctor Attendance</h1>
            <p>{user?.first_name ? `${user.first_name} ${user.last_name ?? ''}` : user?.email}</p>
          </div>
        </div>
        <div className="pa-search-bar">
          <FaSearch className="pa-search-bar__icon" />
          <input
            type="text"
            placeholder="Search exams, rooms, instructors…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="pa-search-bar__clear" onClick={() => setSearchTerm('')}>
              <FaTimes />
            </button>
          )}
        </div>
      </div>

      {/* ── Substitution Dropdown — always visible, collapsed by default ── */}
      {activeTab === 'ongoing' && (
        <div className="pa-sub-accordion">
          <button
            type="button"
            className="pa-sub-accordion__trigger"
            onClick={() => setShowSubstitution(v => !v)}
            aria-expanded={showSubstitution}
          >
            <div className="pa-sub-accordion__trigger-left">
              <span className="pa-sub-accordion__icon"><FaExchangeAlt /></span>
              <span className="pa-sub-accordion__label">Available for Substitution</span>
              {filteredSubExams.length > 0 && (
                <span className="pa-sub-accordion__chip">{filteredSubExams.length}</span>
              )}
            </div>
            <span className="pa-sub-accordion__arrow">
              {showSubstitution ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </button>

          {showSubstitution && (
            <div className="pa-sub-accordion__body">
              {filteredSubExams.length === 0 ? (
                <div className="pa-empty pa-empty--sm">
                  <FaClipboardCheck className="pa-empty__icon" />
                  <p>No exams available for substitution</p>
                </div>
              ) : (
                <div className="pa-grid">
                  {filteredSubExams.map(e => <ExamCard key={e.id} exam={e} isSub />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="pa-tabs">
        {([
          { id: 'ongoing'   as Tab, label: 'Ongoing',  count: ongoingExams.length,   icon: <FaClock /> },
          { id: 'upcoming'  as Tab, label: 'Upcoming', count: upcomingExams.length,  icon: <FaCalendarAlt /> },
          { id: 'completed' as Tab, label: 'History',  count: completedExams.length, icon: <FaHistory /> },
        ]).map(t => (
          <button
            key={t.id}
            className={`pa-tab ${activeTab === t.id ? 'pa-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="pa-tab__icon">{t.icon}</span>
            {t.label}
            <span className="pa-tab__chip">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="pa-loading-state">
          <div className="pa-spinner" /><span>Loading your schedule…</span>
        </div>
      ) : (
        <div className="pa-content">
          <div className="pa-section">
            <div className="pa-section__head">
              <h3 className="pa-section__title">
                {activeTab === 'ongoing'   && 'My Ongoing Exams'}
                {activeTab === 'upcoming'  && 'Upcoming Assignments'}
                {activeTab === 'completed' && 'Attendance History'}
              </h3>
              <span className="pa-section__chip">{currentList.length}</span>
            </div>
            <div className="pa-canvas">
              {currentList.length === 0
                ? (
                  <div className="pa-empty">
                    <FaClipboardCheck className="pa-empty__icon" />
                    <p>
                      {activeTab === 'ongoing'   ? 'No ongoing exams right now'
                      : activeTab === 'upcoming' ? 'No upcoming exams scheduled'
                      : 'No attendance records yet'}
                    </p>
                  </div>
                )
                : <div className="pa-grid">{currentList.map(e => <ExamCard key={e.id} exam={e} />)}</div>
              }
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL ════ */}
      {showModal && selectedExam && (
        <div className="pa-overlay" onClick={closeModal}>
          <div className="pa-modal" onClick={e => e.stopPropagation()}>

            <div className={`pa-modal__header ${isSubstitutionMode ? 'pa-modal__header--sub' : 'pa-modal__header--primary'}`}>
              <div className="pa-modal__header-body">
                <div className="pa-modal__header-icon">
                  {isSubstitutionMode ? <FaExchangeAlt /> : <FaShieldAlt />}
                </div>
                <div>
                  <h3 className="pa-modal__title">{isSubstitutionMode ? 'Substitute Proctorship' : 'Confirm Proctorship'}</h3>
                  <p className="pa-modal__subtitle">{selectedExam.course_id} — {selectedExam.subject}</p>
                </div>
              </div>
              <button className="pa-modal__close-btn" onClick={closeModal}><FaTimes /></button>
            </div>

            <div className="pa-modal__body">
              {isSubstitutionMode && (
                <div className="pa-alert pa-alert--warn">
                  <FaExchangeAlt className="pa-alert__icon" />
                  <div>
                    <p className="pa-alert__title">Substitution Mode Active</p>
                    <p className="pa-alert__desc">You are replacing <strong>{selectedExam.assigned_proctor}</strong> and will be recorded as substitute proctor.</p>
                  </div>
                </div>
              )}

              <div className="pa-exam-card">
                <p className="pa-exam-card__heading">Exam Details</p>
                <div className="pa-exam-card__grid">
                  {[
                    ['Course',    `${selectedExam.course_id} — ${selectedExam.subject}`],
                    ['Section',   selectedExam.section_name],
                    ['Date',      selectedExam.exam_date],
                    ['Time',      `${fmt(selectedExam.exam_start_time)} – ${fmt(selectedExam.exam_end_time)}`],
                    ['Building',  selectedExam.building_name],
                    ['Room',      selectedExam.room_id],
                    ...(selectedExam.instructor_name ? [['Instructor', selectedExam.instructor_name]] : []),
                    ...(selectedExam.assigned_proctor ? [['Assigned Proctor', selectedExam.assigned_proctor]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="pa-exam-card__item">
                      <span className="pa-exam-card__key">{k}</span>
                      <span className="pa-exam-card__val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pa-field">
                <label className="pa-field__lbl">
                  <FaKey style={{ marginRight: 6, opacity: .7 }} />Exam Code (OTP)
                </label>
                <div className="pa-otp-group">
                  <input
                    className={`pa-input pa-input--mono ${otpStatus === 'invalid' ? 'pa-input--err' : ''} ${otpStatus.startsWith('valid') ? 'pa-input--ok' : ''}`}
                    type="text"
                    placeholder="Enter exam OTP"
                    value={otpCode}
                    onChange={e => { setOtpCode(e.target.value); setOtpStatus('idle'); }}
                    onKeyDown={e => e.key === 'Enter' && otpCode.trim() && handleVerify()}
                  />
                  <button
                    className="pa-btn-verify"
                    onClick={handleVerify}
                    disabled={!otpCode.trim() || verifyingOtp}
                  >
                    {verifyingOtp ? <span className="pa-spinner pa-spinner--xs" /> : 'Verify'}
                  </button>
                </div>
                {otpStatus === 'valid-assigned' && (
                  <div className="pa-otp-msg pa-otp-msg--ok">
                    <FaCheckCircle /> Verified — you are the assigned proctor.
                  </div>
                )}
                {otpStatus === 'valid-not-assigned' && (
                  <div className="pa-otp-msg pa-otp-msg--warn">
                    <FaExclamationTriangle /> Valid code — you will be marked as a <strong>substitute proctor</strong>.
                  </div>
                )}
                {otpStatus === 'invalid' && (
                  <div className="pa-otp-msg pa-otp-msg--err">
                    <FaTimes /> Invalid code. Please check and try again.
                  </div>
                )}
              </div>

              <div className="pa-field">
                <label className="pa-field__lbl">
                  Remarks
                  {isSubRole
                    ? <span className="pa-tag pa-tag--required">Required</span>
                    : <span className="pa-tag pa-tag--optional">Optional</span>
                  }
                </label>
                <textarea
                  className={`pa-input pa-textarea ${isSubRole && !remarks.trim() && otpStatus !== 'idle' ? 'pa-input--err' : ''}`}
                  rows={3}
                  placeholder={isSubRole ? 'Reason for substitution (e.g., emergency leave, illness…)' : 'Any notes or observations…'}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
                {isSubRole && !remarks.trim() && otpStatus !== 'idle' && (
                  <span className="pa-err-hint">Remarks are required when substituting.</span>
                )}
              </div>
            </div>

            <div className="pa-modal__footer">
              <button className="pa-btn pa-btn--ghost" onClick={closeModal}>Cancel</button>
              <button
                className="pa-btn pa-btn--submit"
                onClick={handleSubmit}
                disabled={!canSubmit || submittingAttendance}
              >
                {submittingAttendance
                  ? <><span className="pa-spinner pa-spinner--xs" />Submitting…</>
                  : <><FaCheckCircle />Submit Attendance</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctorAttendance;