import {
  FaCalendarCheck,
  FaUsers,
  FaProjectDiagram,
  FaShieldAlt,
  FaFacebookF,
  FaEnvelope,
  FaPhoneAlt,
} from 'react-icons/fa';
import '../styles/F_About.css';

const team = [
  {
    role: 'System Analyst', 
    name: 'Tana Alexandra P. Lastimosa',
    email: 'lastimosa.tana2004@gmail.com',
    fb: 'https://www.facebook.com/tana.lastimosa',
    phone: '09976102529',
  },
  {
    role: 'Front-End Programmer',
    name: 'Marealle G. Elnasin',
    email: 'elnasin.marealle456@gmail.com',
    fb: 'https://www.facebook.com/elnasin.marealle',
    phone: '09051094989',
  },
  {
    role: 'Back-End / Full‑Stack Developer',
    name: 'Ithran Beor Turno',
    email: 'turno.ithranbeor7@gmail.com',
    fb: 'https://www.facebook.com/BeorIthran',
    phone: '09269662797',
    highlight: true,
  },
  {
    role: 'Database Administrator',
    name: 'Jovan O. Labitad',
    email: 'jovanlabitad79@gmail.com',
    fb: 'https://www.facebook.com/jovan.labitad.3',
    phone: '09972157688',
  },
  {
    role: 'Technical Writer',
    name: 'John Paul N. Delmiquez',
    email: 'delmiguez.johnpaul2004@gmail.com',
    fb: 'https://www.facebook.com/yoontaeseoh',
    phone: '09973551713',
  },
];

const AboutExamSync = () => {
  return (
    <div className="about-wrapper">

      {/* HERO */}
      <section className="hero">
        <h1>About ExamSync V2</h1>
        <p>
          A modern web‑based examination management system built from scratch
          to centralize scheduling, proctoring, rooms, and notifications.
        </p>
      </section>

      {/* STATS */}
      <section className="stats">
        <div><h2>10+</h2><span>Core Modules</span></div>
        <div><h2>99%</h2><span>Scheduling Accuracy</span></div>
        <div><h2>500+</h2><span>Handled Exams</span></div>
        <div><h2>600+</h2><span>Faculty & Proctors</span></div>
      </section>

      {/* WHY */}
      <section className="why">
        <div className="why-text">
          <h3>Why ExamSync V2?</h3>
          <p>
            ExamSync V2 was completely rebuilt after the original system’s
            source code became unavailable. The new version focuses on
            scalability, clarity, role‑based access, and operational reliability.
          </p>
          <p>
            Designed for academic institutions, ExamSync simplifies complex
            exam workflows into a single, secure platform.
          </p>
        </div>

        <div className="why-features">
          <div>
            <FaCalendarCheck />
            <h4>Centralized Scheduling</h4>
            <p>Unified exam schedules, rooms, and dates.</p>
          </div>
          <div>
            <FaUsers />
            <h4>Role‑Based Dashboards</h4>
            <p>Separate views for faculty, proctors, and admins.</p>
          </div>
          <div>
            <FaProjectDiagram />
            <h4>Built From Scratch</h4>
            <p>Clean architecture with modern technologies.</p>
          </div>
          <div>
            <FaShieldAlt />
            <h4>Secure & Reliable</h4>
            <p>Controlled access and real‑time monitoring.</p>
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="team">
        <h2>Meet the Development Team</h2>

        <div className="team-grid">
          {team.map((m, i) => (
            <div key={i} className={`team-card ${m.highlight ? 'highlight' : ''}`}>
              <span className="role">{m.role}</span>
              <h4>{m.name}</h4>

              <div className="links">
                <FaEnvelope /> {m.email}
                <a href={m.fb} target="_blank" rel="noreferrer">
                  <FaFacebookF /> Facebook
                </a>
                <span><FaPhoneAlt /> {m.phone}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <footer className="about-footer">
        <h3>ExamSync V2</h3>
        <p>
          Designed, developed, and documented by the ExamSync V2 team.
          <br />
          A complete rebuild for a smarter examination experience.
        </p>
      </footer>

    </div>
  );
};

export default AboutExamSync;