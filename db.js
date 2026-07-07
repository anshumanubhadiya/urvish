/* ==========================================================
   Attendance System - Shared Data Layer (db.js)
   Uses localStorage as a lightweight client-side database.
   All pages (login, faculty, student, report) include this file.

   v2: supports multiple faculty accounts, each with their own
   list of subjects they teach, and subject-wise attendance
   (a student can have separate Present/Absent records per
   subject on the same day, e.g. Maths + Physics).
   ========================================================== */

const DB = {
  KEYS: {
    FACULTY: "att_faculty",
    STUDENTS: "att_students",
    ATTENDANCE: "att_records",
    SESSION: "att_session"
  },

  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  /* ---------- First-run seed data ---------- */
  init() {
    if (!localStorage.getItem(this.KEYS.FACULTY)) {
      this._set(this.KEYS.FACULTY, [
        { id: "admin1", name: "Mr. Sharma", password: "admin123", subjects: ["Mathematics"] },
        { id: "admin2", name: "Ms. Verma", password: "secure456", subjects: ["Physics", "Chemistry"] }
      ]);
    } else {
      // migrate old faculty records that don't have a subjects field yet
      const list = this.getFaculty();
      let changed = false;
      list.forEach(f => { if (!f.subjects) { f.subjects = []; changed = true; } });
      if (changed) this._set(this.KEYS.FACULTY, list);
    }
    if (!localStorage.getItem(this.KEYS.STUDENTS)) {
      this._set(this.KEYS.STUDENTS, [
        {
          enrollment: "student1",
          name: "Aman Kumar",
          className: "BCA-3A",
          password: "stu123",
          faceDescriptor: null,
          biometricCredId: null
        },
        {
          enrollment: "student2",
          name: "Priya Singh",
          className: "BCA-3A",
          password: "learn456",
          faceDescriptor: null,
          biometricCredId: null
        }
      ]);
    }
    if (!localStorage.getItem(this.KEYS.ATTENDANCE)) {
      this._set(this.KEYS.ATTENDANCE, []); // { date, enrollment, subject, status, method, time, markedBy }
    } else {
      // migrate old records without a subject field
      const records = this.getAttendance();
      let changed = false;
      records.forEach(r => { if (!r.subject) { r.subject = "General"; changed = true; } });
      if (changed) this._set(this.KEYS.ATTENDANCE, records);
    }
  },

  /* ---------- Faculty ---------- */
  getFaculty() { return this._get(this.KEYS.FACULTY, []); },
  findFaculty(id, password) {
    return this.getFaculty().find(f => f.id === id && f.password === password);
  },
  findFacultyById(id) { return this.getFaculty().find(f => f.id === id); },
  facultyIdExists(id) { return this.getFaculty().some(f => f.id === id); },
  addFaculty(fac) {
    const list = this.getFaculty();
    list.push(fac);
    this._set(this.KEYS.FACULTY, list);
  },
  updateFaculty(id, updates) {
    const list = this.getFaculty();
    const idx = list.findIndex(f => f.id === id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this._set(this.KEYS.FACULTY, list);
      return true;
    }
    return false;
  },
  addSubjectToFaculty(id, subject) {
    const fac = this.findFacultyById(id);
    if (!fac) return false;
    if (!fac.subjects.includes(subject)) {
      fac.subjects.push(subject);
      this.updateFaculty(id, { subjects: fac.subjects });
    }
    return true;
  },
  removeSubjectFromFaculty(id, subject) {
    const fac = this.findFacultyById(id);
    if (!fac) return false;
    fac.subjects = fac.subjects.filter(s => s !== subject);
    this.updateFaculty(id, { subjects: fac.subjects });
    return true;
  },
  getAllSubjects() {
    const set = new Set();
    this.getFaculty().forEach(f => (f.subjects || []).forEach(s => set.add(s)));
    return Array.from(set).sort();
  },

  /* ---------- Students ---------- */
  getStudents() { return this._get(this.KEYS.STUDENTS, []); },
  findStudent(enrollment) {
    return this.getStudents().find(s => s.enrollment === enrollment);
  },
  findStudentLogin(enrollment, password) {
    return this.getStudents().find(s => s.enrollment === enrollment && s.password === password);
  },
  enrollmentExists(enrollment) { return this.getStudents().some(s => s.enrollment === enrollment); },
  addStudent(student) {
    const list = this.getStudents();
    list.push(student);
    this._set(this.KEYS.STUDENTS, list);
  },
  updateStudent(enrollment, updates) {
    const list = this.getStudents();
    const idx = list.findIndex(s => s.enrollment === enrollment);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
      this._set(this.KEYS.STUDENTS, list);
      return true;
    }
    return false;
  },
  deleteStudent(enrollment) {
    let list = this.getStudents();
    list = list.filter(s => s.enrollment !== enrollment);
    this._set(this.KEYS.STUDENTS, list);
    let records = this.getAttendance();
    records = records.filter(r => r.enrollment !== enrollment);
    this._set(this.KEYS.ATTENDANCE, records);
  },
  getClasses() {
    const set = new Set(this.getStudents().map(s => s.className));
    return Array.from(set);
  },

  /* ---------- Attendance (now subject-aware) ---------- */
  getAttendance() { return this._get(this.KEYS.ATTENDANCE, []); },

  // A student can have one record per (enrollment, date, subject) combination
  markAttendance(enrollment, status, method, subject, markedBy) {
    const records = this.getAttendance();
    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toLocaleTimeString();
    const existingIdx = records.findIndex(
      r => r.enrollment === enrollment && r.date === today && r.subject === subject
    );
    const entry = { date: today, enrollment, subject, status, method, time, markedBy: markedBy || null };
    if (existingIdx > -1) {
      records[existingIdx] = entry;
    } else {
      records.push(entry);
    }
    this._set(this.KEYS.ATTENDANCE, records);
    return entry;
  },
  getAttendanceForStudent(enrollment) {
    return this.getAttendance().filter(r => r.enrollment === enrollment)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  getAttendanceForDate(date) {
    return this.getAttendance().filter(r => r.date === date);
  },
  getTodayStatus(enrollment, subject) {
    const today = new Date().toISOString().slice(0, 10);
    return this.getAttendance().find(
      r => r.enrollment === enrollment && r.date === today && r.subject === subject
    );
  },
  // Per-subject summary for one student: { Maths: {present, absent, pct}, Physics: {...} }
  getSubjectSummaryForStudent(enrollment) {
    const records = this.getAttendanceForStudent(enrollment);
    const summary = {};
    records.forEach(r => {
      if (!summary[r.subject]) summary[r.subject] = { present: 0, absent: 0 };
      summary[r.subject][r.status] += 1;
    });
    Object.keys(summary).forEach(sub => {
      const s = summary[sub];
      const total = s.present + s.absent;
      s.pct = total ? Math.round((s.present / total) * 100) : 0;
    });
    return summary;
  },

  /* ---------- Session ---------- */
  setSession(role, id) { this._set(this.KEYS.SESSION, { role, id }); },
  getSession() { return this._get(this.KEYS.SESSION, null); },
  clearSession() { localStorage.removeItem(this.KEYS.SESSION); },

  /* ---------- Utility ---------- */
  csvExport(rows, filename) {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

DB.init();
