export type UserRole =
  | 'super_admin'
  | 'kepala_sekolah'
  | 'guru'
  | 'tendik'
  | 'supervisor'
  | 'wali_kelas'
  | 'orang_tua';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrator',
  kepala_sekolah: 'Kepala Sekolah',
  guru: 'Guru',
  tendik: 'Tenaga Kependidikan',
  supervisor: 'Supervisor',
  wali_kelas: 'Wali Kelas',
  orang_tua: 'Orang Tua / Wali',
};

export interface UserAccount {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  activeStatus: 'aktif' | 'nonaktif';
  linkedClassId?: string;
  linkedStudentIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SchoolContent {
  id: string;
  sectionKey: string;
  title: string;
  subtitle?: string;
  body: string;
  items?: { label: string; value: string; description?: string }[];
  updatedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  imageUrl?: string;
  publishedDate: string;
  authorName: string;
  isPublished: boolean;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: 'publik' | 'guru' | 'orang_tua' | 'semua';
  priority: 'normal' | 'penting';
  publishedDate: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademicEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  category: string;
  description?: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GalleryItem {
  id: string;
  title: string;
  mediaType: 'foto' | 'video';
  category: string;
  caption: string;
  mediaUrl?: string;
  eventDate: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Achievement {
  id: string;
  title: string;
  recipientName: string;
  level: 'Kabupaten' | 'Provinsi' | 'Nasional' | 'Internasional';
  year: string;
  category: string;
  description?: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicDirectoryEntry {
  id: string;
  name: string;
  roleType: 'guru' | 'tendik' | 'pimpinan';
  position: string;
  subject?: string;
  education?: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademicYear {
  id: string;
  name: string;
  semester: 'Ganjil' | 'Genap';
  isActive: boolean;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: 'X' | 'XI' | 'XII';
  academicYearName: string;
  homeroomTeacherName: string;
  homeroomTeacherUid?: string;
  studentCount?: number;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  category: string;
  kkm: number;
  hoursPerWeek?: number;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeacherStaff {
  id: string;
  nip: string;
  name: string;
  staffType: 'guru' | 'tendik';
  position: string;
  subjectName?: string;
  employmentStatus: string;
  email?: string;
  phone?: string;
  userUid?: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classId: string;
  className: string;
  academicYearName?: string;
  status: 'aktif' | 'lulus' | 'mutasi' | 'cuti';
  parentName: string;
  parentEmail?: string;
  parentUid?: string;
  previousSchool?: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GradeRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  subjectName: string;
  semester: 'Ganjil' | 'Genap';
  academicYearName: string;
  uhScore?: number;
  utsScore?: number;
  uasScore?: number;
  finalScore: number;
  predicate: string;
  parentEmail?: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';

export interface AttendanceRecord {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  subjectName?: string;
  status: AttendanceStatus;
  note?: string;
  parentEmail?: string;
  recordedByName: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceNotification {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  parentEmail: string;
  date: string;
  status: AttendanceStatus;
  message: string;
  isRead: boolean;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ArchiveRootCategory = 'Manajerial' | 'Kewirausahaan' | 'Supervisi Tendik';
export type ArchiveFileType = 'PDF' | 'DOCX' | 'XLSX' | 'PPTX' | 'JPG' | 'PNG';

export interface ArchiveFolder {
  id: string;
  name: string;
  rootCategory: ArchiveRootCategory;
  parentFolderId?: string;
  description?: string;
  allowedRoles: UserRole[];
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ArchiveVersionEntry {
  version: number;
  updatedAt: string;
  updatedBy: string;
  note: string;
}

export interface DigitalArchive {
  id: string;
  title: string;
  folderId: string;
  rootCategory: ArchiveRootCategory;
  fileName: string;
  fileType: ArchiveFileType;
  fileSize?: number;
  year: string;
  documentDate: string;
  description?: string;
  currentVersion: number;
  versions?: ArchiveVersionEntry[];
  contentDataUrl?: string;
  linkedIndicatorCode?: string;
  uploadedByName: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupervisionInstrument {
  id: string;
  code: string;
  title: string;
  targetType: 'kepala_sekolah' | 'guru' | 'tendik';
  year: string;
  description?: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupervisionIndicator {
  id: string;
  instrumentId: string;
  sheetCode: string;
  sheetTitle: string;
  sectionCode?: string;
  sectionTitle: string;
  orderIndex: number;
  code: string;
  taskOrIndicator: string;
  physicalEvidence: string[];
  inspectionMethod?: string;
  generalItemLink?: string;
  maxScale: number;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupervisionSchedule {
  id: string;
  instrumentId: string;
  instrumentTitle: string;
  academicYearName: string;
  period: string;
  targetName: string;
  targetRole: string;
  targetEmail?: string;
  supervisorName: string;
  scheduledDate: string;
  status: 'Terjadwal' | 'Berlangsung' | 'Selesai' | 'Disetujui';
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupervisionItemScore {
  scale: 1 | 2 | 3 | 4 | null;
  score: number;
  note: string;
  linkedArchiveId?: string;
  linkedArchiveTitle?: string;
  checkedEvidence?: number[];
}

export interface SupervisionAssessment {
  id: string;
  scheduleId?: string;
  instrumentId: string;
  instrumentTitle: string;
  schoolName: string;
  assessedPersonName: string;
  assessedPersonRole?: string;
  assessedPersonEmail?: string;
  supervisorName: string;
  academicYearName: string;
  period: string;
  itemScores?: Record<string, SupervisionItemScore>;
  sheetNotes?: Record<string, string>;
  overallScore: number;
  overallMaxScore: number;
  overallPercentage: number;
  overallPredicate: string;
  unfilledCount: number;
  recommendations?: string;
  followUpPlan?: string;
  followUpDeadline?: string;
  status: 'Draft' | 'Selesai' | 'Disetujui';
  approvedByName?: string;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  details: string;
  createdAt?: unknown;
}

export type DashboardSection =
  | 'overview'
  | 'academic'
  | 'attendance'
  | 'archives'
  | 'supervision'
  | 'cms'
  | 'cms_media'
  | 'users_audit'
  | 'parent_portal';
