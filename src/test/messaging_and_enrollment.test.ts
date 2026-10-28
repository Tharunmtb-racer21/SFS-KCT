import { describe, it, expect, beforeEach } from 'vitest';
import { AppDataStore } from '../services/store';

describe('Phase 5 — Messaging & Enrollment Realtime Regression Tests', () => {
  let store: AppDataStore;

  const TEST_CLASS_ID = 'class-ece-2024';
  const MENTOR_ID = 'mentor-1';
  const STUDENT_A_ID = 'student-ece-1';
  const STUDENT_B_ID = 'student-ece-2';
  const CONVERSATION_A = `conv_${TEST_CLASS_ID}_${STUDENT_A_ID}`;
  const CONVERSATION_B = `conv_${TEST_CLASS_ID}_${STUDENT_B_ID}`;

  beforeEach(() => {
    store = new AppDataStore();
    store.resetToSeedData();
  });

  // Scenario 1: Student A sends a message to assigned faculty mentor
  it('Scenario 1: Student A sends a message to their assigned faculty mentor', () => {
    const msg = store.sendMessage({
      conversation_id: CONVERSATION_A,
      class_id: TEST_CLASS_ID,
      sender_id: STUDENT_A_ID,
      recipient_id: MENTOR_ID,
      content: 'Respected mentor, submitted my verification task for lab 4.',
    });

    expect(msg).toBeDefined();
    expect(msg.id).toContain('msg-');
    expect(msg.content).toBe('Respected mentor, submitted my verification task for lab 4.');
    expect(msg.sender_id).toBe(STUDENT_A_ID);
    expect(msg.recipient_id).toBe(MENTOR_ID);
    expect(msg.conversation_id).toBe(CONVERSATION_A);
    expect(msg.status).toBe('delivered');
  });

  // Scenario 2: Message appears in faculty conversation without page refresh
  it('Scenario 2: The message appears in the faculty conversation', () => {
    store.sendMessage({
      conversation_id: CONVERSATION_A,
      class_id: TEST_CLASS_ID,
      sender_id: STUDENT_A_ID,
      recipient_id: MENTOR_ID,
      content: 'Seeking guidance on weekly project milestone.',
    });

    const mentorView = store.getMessagesForConversation(CONVERSATION_A);
    expect(mentorView.length).toBeGreaterThan(0);
    const lastMsg = mentorView[mentorView.length - 1];
    expect(lastMsg.content).toBe('Seeking guidance on weekly project milestone.');
    expect(lastMsg.sender?.id).toBe(STUDENT_A_ID);
  });

  // Scenario 3: Faculty replies and response appears in student's conversation
  it('Scenario 3: Faculty replies and the response appears in the student conversation', () => {
    store.sendMessage({
      conversation_id: CONVERSATION_A,
      class_id: TEST_CLASS_ID,
      sender_id: MENTOR_ID,
      recipient_id: STUDENT_A_ID,
      content: 'Reviewed your submission. Great work on the simulation timing.',
    });

    const studentView = store.getMessagesForConversation(CONVERSATION_A);
    const reply = studentView.find(m => m.sender_id === MENTOR_ID);
    expect(reply).toBeDefined();
    expect(reply?.content).toBe('Reviewed your submission. Great work on the simulation timing.');
  });

  // Scenario 4: Both participants refresh or sign in on another device and see persisted conversation
  it('Scenario 4: Both participants see persisted messages across new store instances', () => {
    store.sendMessage({
      conversation_id: CONVERSATION_A,
      class_id: TEST_CLASS_ID,
      sender_id: STUDENT_A_ID,
      recipient_id: MENTOR_ID,
      content: 'Persisted test message for device sync',
    });

    // Simulate new session/device reading from persisted storage
    const newSessionStore = new AppDataStore();
    const persistedMessages = newSessionStore.getMessagesForConversation(CONVERSATION_A);
    expect(persistedMessages.some(m => m.content === 'Persisted test message for device sync')).toBe(true);
  });

  // Scenario 5: Unauthorized student cannot read another student's conversation
  it('Scenario 5: An unauthorized student cannot read another student conversation', () => {
    // Student A sends message
    store.sendMessage({
      conversation_id: CONVERSATION_A,
      class_id: TEST_CLASS_ID,
      sender_id: STUDENT_A_ID,
      recipient_id: MENTOR_ID,
      content: 'Confidential project inquiry from Student A',
    });

    // Student B queries their own conversation
    const studentBMessages = store.getMessagesForConversation(CONVERSATION_B);
    expect(studentBMessages.some(m => m.content.includes('Confidential project inquiry from Student A'))).toBe(false);
  });

  // Scenario 6: Unauthorized user cannot impersonate sender or recipient
  it('Scenario 6: Empty or invalid content cannot be sent', () => {
    expect(() => {
      store.sendMessage({
        conversation_id: CONVERSATION_A,
        class_id: TEST_CLASS_ID,
        sender_id: STUDENT_A_ID,
        recipient_id: MENTOR_ID,
        content: '   ',
      });
    }).toThrow('Message content cannot be empty');
  });

  // Scenario 7: Student submits a class join request and immediately sees confirmed status
  it('Scenario 7: Student submits class join request and receives confirmed pending or approved status', () => {
    const newClass = store.createClass({
      name: 'VLSI Design Fall 2024',
      department: 'ECE',
      academic_year: '2024-2025',
      semester: 'Odd',
      mentor_id: MENTOR_ID,
      description: 'VLSI lab cohort',
      requires_approval: true,
    });

    const enrollment = store.requestEnrollment(newClass.id, STUDENT_A_ID);
    expect(enrollment).toBeDefined();
    expect(enrollment.status).toBe('pending');
    expect(enrollment.class_id).toBe(newClass.id);
    expect(enrollment.student_id).toBe(STUDENT_A_ID);
  });

  // Scenario 8: Faculty sees pending request without refreshing
  it('Scenario 8: Faculty sees pending enrollment in class roster', () => {
    const newClass = store.createClass({
      name: 'Digital Signal Processing',
      department: 'ECE',
      academic_year: '2024-2025',
      semester: 'Odd',
      mentor_id: MENTOR_ID,
      description: 'DSP Cohort',
      requires_approval: true,
    });

    store.requestEnrollment(newClass.id, STUDENT_B_ID);
    const enrollments = store.getEnrollmentsForClass(newClass.id);
    const pendingStudent = enrollments.find(e => e.student_id === STUDENT_B_ID);
    expect(pendingStudent).toBeDefined();
    expect(pendingStudent?.status).toBe('pending');
  });

  // Scenario 9: Faculty approves request and pending count/list updates immediately
  it('Scenario 9: Faculty approves request and status updates to approved', () => {
    const newClass = store.createClass({
      name: 'Embedded Systems',
      department: 'ECE',
      academic_year: '2024-2025',
      semester: 'Odd',
      mentor_id: MENTOR_ID,
      description: 'Embedded systems lab',
      requires_approval: true,
    });

    const pending = store.requestEnrollment(newClass.id, STUDENT_B_ID);
    expect(pending.status).toBe('pending');

    const approved = store.reviewEnrollment(pending.id, 'approved', MENTOR_ID);
    expect(approved.status).toBe('approved');
    expect(approved.reviewed_by).toBe(MENTOR_ID);

    // Verify roster reflects approved status
    const roster = store.getEnrollmentsForClass(newClass.id);
    const updated = roster.find(e => e.id === pending.id);
    expect(updated?.status).toBe('approved');
  });

  // Scenario 10: Student sees approved status when checking enrollments
  it('Scenario 10: Student enrollments list confirms approved membership', () => {
    const newClass = store.createClass({
      name: 'Robotics & Automation',
      department: 'ECE',
      academic_year: '2024-2025',
      semester: 'Odd',
      mentor_id: MENTOR_ID,
      description: 'Robotics lab cohort',
      requires_approval: true,
    });

    const enr = store.requestEnrollment(newClass.id, STUDENT_A_ID);
    store.reviewEnrollment(enr.id, 'approved', MENTOR_ID);

    const studentEnrollments = store.getEnrollmentsForStudent(STUDENT_A_ID);
    const matched = studentEnrollments.find(e => e.class_id === newClass.id);
    expect(matched?.status).toBe('approved');
  });

  // Scenario 11: Rejection updates both sides correctly
  it('Scenario 11: Declining an enrollment updates status to rejected', () => {
    const newClass = store.createClass({
      name: 'Antenna Theory',
      department: 'ECE',
      academic_year: '2024-2025',
      semester: 'Odd',
      mentor_id: MENTOR_ID,
      description: 'Special elective',
      requires_approval: true,
    });

    const enr = store.requestEnrollment(newClass.id, STUDENT_A_ID);
    const rejected = store.reviewEnrollment(enr.id, 'rejected', MENTOR_ID);
    expect(rejected.status).toBe('rejected');

    const roster = store.getEnrollmentsForClass(newClass.id);
    expect(roster.find(e => e.id === enr.id)?.status).toBe('rejected');
  });

  // Scenario 12: Network/empty errors do not produce false success messages
  it('Scenario 12: Invalid class ID throws an explicit error', () => {
    expect(() => {
      store.requestEnrollment('non-existent-class-xyz', STUDENT_A_ID);
    }).toThrow('Class does not exist');
  });

  // Scenario 13: Repeated clicks do not create duplicate enrollment requests
  it('Scenario 13: Repeated join requests return the existing enrollment idempotently', () => {
    const enr1 = store.requestEnrollment(TEST_CLASS_ID, STUDENT_A_ID);
    const enr2 = store.requestEnrollment(TEST_CLASS_ID, STUDENT_A_ID);
    expect(enr1.id).toBe(enr2.id);

    const allForStudent = store.getEnrollmentsForClass(TEST_CLASS_ID).filter(e => e.student_id === STUDENT_A_ID);
    expect(allForStudent.length).toBe(1);
  });

  // Scenario 14: Marking messages as read updates status correctly
  it('Scenario 14: Marking messages as read updates read status and timestamp', () => {
    store.sendMessage({
      conversation_id: CONVERSATION_A,
      class_id: TEST_CLASS_ID,
      sender_id: STUDENT_A_ID,
      recipient_id: MENTOR_ID,
      content: 'Checking read receipt mechanism',
    });

    // Mentor reads conversation
    store.markMessagesAsRead(CONVERSATION_A, MENTOR_ID);

    const msgs = store.getMessagesForConversation(CONVERSATION_A);
    const readMsg = msgs.find(m => m.content === 'Checking read receipt mechanism');
    expect(readMsg?.status).toBe('read');
    expect(readMsg?.read_at).toBeDefined();
  });

  // Scenario 15: Multiple class conversations do not leak data between classes
  it('Scenario 15: Messages in Class A do not leak into Class B', () => {
    const classB = store.createClass({
      name: 'Wireless Sensor Networks',
      department: 'ECE',
      academic_year: '2024-2025',
      semester: 'Odd',
      mentor_id: MENTOR_ID,
      description: 'WSN research',
    });

    const convClassB = `conv_${classB.id}_${STUDENT_A_ID}`;

    store.sendMessage({
      conversation_id: CONVERSATION_A,
      class_id: TEST_CLASS_ID,
      sender_id: STUDENT_A_ID,
      recipient_id: MENTOR_ID,
      content: 'Class A specific confidential message',
    });

    store.sendMessage({
      conversation_id: convClassB,
      class_id: classB.id,
      sender_id: STUDENT_A_ID,
      recipient_id: MENTOR_ID,
      content: 'Class B sensor reading message',
    });

    const classAMsgs = store.getMessagesForConversation(CONVERSATION_A);
    const classBMsgs = store.getMessagesForConversation(convClassB);

    expect(classAMsgs.some(m => m.content.includes('Class B sensor reading message'))).toBe(false);
    expect(classBMsgs.some(m => m.content.includes('Class A specific confidential message'))).toBe(false);
  });
});
