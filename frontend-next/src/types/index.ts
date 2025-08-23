export type User = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher';
};

export type Stream = {
  id: string;
  name: string;
  description: string;
  adminId: string;
};

export type Course = {
  id: string;
  name: string;
  code: string;
  description: string;
  adminId: string;
  streamId: string;
};

export type Class = {
  id: string;
  courseId: string;
  name: string;
  type: 'theory' | 'lab';
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string;
  endTime: string;
};

export type Attendance = {
  id: string;
  classId: string;
  userId: string;
  date: string;
  status: 'present' | 'absent' | 'cancelled' | 'replaced';
  replacedWith?: string;
};
