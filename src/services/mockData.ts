import { Profile, ClassGroup, ClassEnrollment, DailyPost, WeeklyReport, NotificationItem } from '../types';

export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'mentor-1',
    role: 'mentor',
    full_name: 'Dr. A. Ramanathan',
    email: 'ramanathan.a.ece@kct.ac.in',
    department: 'Electronics and Communication Engineering',
    bio: 'Associate Professor & Senior Faculty Mentor. Specializing in Embedded Systems, IoT, and Student Innovation.',
    skills: ['Embedded Systems', 'IoT Architectures', 'VLSI Design', 'Academic Mentoring', 'Research Guidance'],
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-ece-1',
    role: 'student',
    full_name: 'Kavitha Sundaram',
    email: 'kavitha.22ec@kct.ac.in',
    student_reg_no: '717822ECE042',
    phone: '+91 98421 54321', // Private
    department: 'Electronics and Communication Engineering',
    academic_year: '3rd Year / Semester 5',
    bio: 'Passionate about Edge AI and FPGA signal processing. Student lead in Campus Robotics Club.',
    skills: ['Verilog HDL', 'Python', 'Edge AI', 'MATLAB', 'PCB Design', 'FreeRTOS'],
    career_goals: 'Core hardware engineer at a semiconductor enterprise or embedded AI researcher.',
    hobbies: 'Competitive Robotics, Badminton, Open-source microcontroller firmware',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-ece-2',
    role: 'student',
    full_name: 'Rahul Varma',
    email: 'rahul.22ec@kct.ac.in',
    student_reg_no: '717822ECE089',
    phone: '+91 98421 88776', // Private
    department: 'Electronics and Communication Engineering',
    academic_year: '3rd Year / Semester 5',
    bio: 'Working on automotive CAN bus telemetry and ESP32 wireless sensors.',
    skills: ['Embedded C', 'STM32 Microcontrollers', 'CAN Protocol', 'Linux Device Drivers'],
    career_goals: 'Automotive embedded systems architect.',
    hobbies: 'Electronics prototyping, Cycling',
    created_at: new Date(Date.now() - 55 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-ece-3',
    role: 'student',
    full_name: 'Deepak Krishnan',
    email: 'deepak.22ec@kct.ac.in',
    student_reg_no: '717822ECE024',
    phone: '+91 97890 12345',
    department: 'Electronics and Communication Engineering',
    academic_year: '3rd Year / Semester 5',
    bio: 'Enthusiastic about RF communication and antenna design.',
    skills: ['RF Design', 'C++', 'Circuit Simulation'],
    career_goals: 'RF Systems Specialist',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-mech-1',
    role: 'student',
    full_name: 'Sanjay Karthik',
    email: 'sanjay.22me@kct.ac.in',
    student_reg_no: '717822MECH015',
    phone: '+91 94432 99881',
    department: 'Mechanical Engineering',
    academic_year: '3rd Year / Semester 5',
    bio: 'Focusing on Formula Student EV chassis simulation and structural analysis.',
    skills: ['SolidWorks', 'ANSYS FEA', 'Additive Manufacturing', 'GD&T'],
    career_goals: 'EV Powertrain & Chassis Design Engineer',
    hobbies: 'Formula Student racing team, 3D printing',
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const INITIAL_CLASSES: ClassGroup[] = [
  {
    id: 'class-ece-2024',
    mentor_id: 'mentor-1',
    name: 'ECE-A 2023-2027',
    department: 'Electronics and Communication Engineering',
    academic_year: '2024-2025',
    semester: 'Semester 5',
    description: 'Third-year ECE Section A mentoring group: Tracking mini-projects, industrial internships, lab experiments, and weekly reflections.',
    invite_code: 'ece-a-token-98f2b',
    invite_active: true,
    requires_approval: true,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'class-mech-2024',
    mentor_id: 'mentor-1',
    name: 'MECH-B 2023-2027',
    department: 'Mechanical Engineering',
    academic_year: '2024-2025',
    semester: 'Semester 5',
    description: 'Third-year Mechanical Section B cohort: CAD modeling, finite element simulations, and automotive projects.',
    invite_code: 'mech-b-token-7c3a1',
    invite_active: true,
    requires_approval: true,
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const INITIAL_ENROLLMENTS: ClassEnrollment[] = [
  {
    id: 'enroll-1',
    class_id: 'class-ece-2024',
    student_id: 'student-ece-1',
    status: 'approved',
    requested_at: new Date(Date.now() - 50 * 86400000).toISOString(),
    reviewed_at: new Date(Date.now() - 49 * 86400000).toISOString(),
    reviewed_by: 'mentor-1',
  },
  {
    id: 'enroll-2',
    class_id: 'class-ece-2024',
    student_id: 'student-ece-2',
    status: 'approved',
    requested_at: new Date(Date.now() - 48 * 86400000).toISOString(),
    reviewed_at: new Date(Date.now() - 47 * 86400000).toISOString(),
    reviewed_by: 'mentor-1',
  },
  {
    id: 'enroll-3',
    class_id: 'class-ece-2024',
    student_id: 'student-ece-3',
    status: 'pending', // Pending approval queue
    requested_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'enroll-4',
    class_id: 'class-mech-2024',
    student_id: 'student-mech-1',
    status: 'approved',
    requested_at: new Date(Date.now() - 35 * 86400000).toISOString(),
    reviewed_at: new Date(Date.now() - 34 * 86400000).toISOString(),
    reviewed_by: 'mentor-1',
  }
];

export const INITIAL_DAILY_POSTS: DailyPost[] = [
  {
    id: 'post-1',
    class_id: 'class-ece-2024',
    student_id: 'student-ece-1',
    category: 'Project Milestone',
    title: 'Implemented TinyML Quantized CNN Model on Raspberry Pi Pico',
    description: 'Successfully deployed an 8-bit quantized keyword spotting model onto RP2040 using TensorFlow Lite for Microcontrollers. Achieved 94.2% test accuracy on vocal trigger phrases with under 42ms inference latency.',
    skills_gained: ['TFLite Micro', 'Model Quantization', 'Microcontroller DMA', 'C++ Audio DSP'],
    challenges: 'Encountered memory overflow during tensor arena allocation; solved by reducing layer filter counts.',
    next_steps: 'Connect I2S MEMS microphone for live ambient noise acoustic testing.',
    activity_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    attachment_name: 'tinyml_benchmark_report.pdf',
    attachment_type: 'pdf',
    attachment_url: 'https://example.com/tinyml_benchmark.pdf',
    location_name: 'Embedded Systems Research Lab 402',
    created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 26 * 3600000).toISOString(),
    reactions: [
      { id: 'r-1', post_id: 'post-1', user_id: 'mentor-1', reaction_type: 'Excellent', created_at: new Date().toISOString(), user_name: 'Dr. A. Ramanathan' },
      { id: 'r-2', post_id: 'post-1', user_id: 'student-ece-2', reaction_type: 'WOW', created_at: new Date().toISOString(), user_name: 'Rahul Varma' },
    ],
    feedback: [
      {
        id: 'fb-1',
        post_id: 'post-1',
        mentor_id: 'mentor-1',
        content: 'Remarkable latency reduction Kavitha! Make sure you document power consumption during continuous inference so we can compare it with the STM32 benchmarks.',
        created_at: new Date(Date.now() - 18 * 3600000).toISOString(),
      }
    ]
  },
  {
    id: 'post-2',
    class_id: 'class-ece-2024',
    student_id: 'student-ece-2',
    category: 'Lab Experiment',
    title: 'CAN Bus Communication Interface with Dual STM32 Nodes',
    description: 'Set up hardware transceiver loop between STM32F401 and STM32F103 boards at 500kbps baud rate. Verified frame transmission with standard 11-bit IDs and configured hardware acceptance filter masks.',
    skills_gained: ['CAN 2.0B Protocol', 'Logic Analyzer Probing', 'Baud Rate Timing Registers'],
    challenges: 'Bus off state triggered due to missing termination resistor on bus line 2.',
    next_steps: 'Incorporate CRC error injection tests and log frame stats.',
    activity_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    location_name: 'Campus Automotive IoT Lab',
    created_at: new Date(Date.now() - 50 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 50 * 3600000).toISOString(),
    reactions: [
      { id: 'r-3', post_id: 'post-2', user_id: 'mentor-1', reaction_type: 'Great', created_at: new Date().toISOString(), user_name: 'Dr. A. Ramanathan' },
      { id: 'r-4', post_id: 'post-2', user_id: 'student-ece-1', reaction_type: 'Appreciate', created_at: new Date().toISOString(), user_name: 'Kavitha Sundaram' }
    ],
    feedback: [
      {
        id: 'fb-2',
        post_id: 'post-2',
        mentor_id: 'mentor-1',
        content: 'Good diagnostic catch on the 120-ohm termination resistance Rahul. Keep this schematic in your project portfolio.',
        created_at: new Date(Date.now() - 42 * 3600000).toISOString(),
      }
    ]
  },
  {
    id: 'post-3',
    class_id: 'class-mech-2024',
    student_id: 'student-mech-1',
    category: 'Project Milestone',
    title: 'Formula Student Front Upright Topology Optimization',
    description: 'Executed topological mass reduction analysis in ANSYS for 7075-T6 aluminum uprights under 3G bump and 2G cornering load cases. Achieved 28% weight reduction while preserving safety factor > 1.65.',
    skills_gained: ['ANSYS Mechanical FEA', 'Topology Optimization', 'Stress Analysis'],
    challenges: 'Stress singularities around bearing press-fit surfaces needed mesh refinement.',
    next_steps: 'Prepare 5-axis CNC machining toolpath simulation.',
    activity_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    location_name: 'CAD/CAM Simulation Center',
    created_at: new Date(Date.now() - 20 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 3600000).toISOString(),
    reactions: [
      { id: 'r-5', post_id: 'post-3', user_id: 'mentor-1', reaction_type: 'WOW', created_at: new Date().toISOString(), user_name: 'Dr. A. Ramanathan' }
    ],
    feedback: [
      {
        id: 'fb-3',
        post_id: 'post-3',
        mentor_id: 'mentor-1',
        content: 'Impressive safety factor margin Sanjay. Validate the fatigue life cycles under cyclic loading next.',
        created_at: new Date(Date.now() - 15 * 3600000).toISOString()
      }
    ]
  }
];

export const INITIAL_WEEKLY_REPORTS: WeeklyReport[] = [
  {
    id: 'wrep-1',
    class_id: 'class-ece-2024',
    student_id: 'student-ece-1',
    week_number: 8,
    start_date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    end_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    achievements: 'Completed TinyML edge keyword recognition pipeline on RP2040 and submitted conference workshop paper draft.',
    activities_completed: 'TFLite quantization, memory footprint reduction, cross-compilation with ARM GCC, lab demo presentation.',
    skills_learned: 'Embedded inference optimization, quantization-aware training, real-time audio pipeline buffering.',
    goals_achieved: 'Model footprint constrained within 120KB flash and 40KB SRAM.',
    difficulties_faced: 'Microphone ADC noise filtering required digital biquad filter calibration.',
    next_week_goals: 'Connect wireless BLE peripheral to relay inference triggers to cloud dashboard.',
    status: 'submitted',
    submitted_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    mentor_reviewed: true,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    feedback: [
      {
        id: 'wfb-1',
        report_id: 'wrep-1',
        mentor_id: 'mentor-1',
        content: 'Comprehensive progress this week Kavitha. The conference draft demonstrates solid rigor. Continue with the BLE integration.',
        created_at: new Date(Date.now() - 12 * 3600000).toISOString()
      }
    ]
  },
  {
    id: 'wrep-2',
    class_id: 'class-ece-2024',
    student_id: 'student-ece-2',
    week_number: 8,
    start_date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    end_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    achievements: 'Configured CAN transceiver hardware and transmitted 10,000 telemetry test frames with 0 parity errors.',
    activities_completed: 'STM32 firmware writing, hardware prototyping, baud rate timing calculation, oscilloscopic signal verification.',
    skills_learned: 'Differential signaling principles, interrupt-driven UART & CAN reception.',
    goals_achieved: 'Zero frame drop over 30-minute stress testing cycle.',
    difficulties_faced: 'Ground loop noise between bench power supply and microcontroller board.',
    next_week_goals: 'Interface OBD-II connector emulator and parse live vehicle RPM / coolant temperature frames.',
    status: 'submitted',
    submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    mentor_reviewed: true,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    feedback: [
      {
        id: 'wfb-2',
        report_id: 'wrep-2',
        mentor_id: 'mentor-1',
        content: 'Solid engineering documentation Rahul. You have met this week milestones cleanly.',
        created_at: new Date(Date.now() - 20 * 3600000).toISOString()
      }
    ]
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    user_id: 'mentor-1',
    title: 'New Student Registration Pending',
    message: 'Deepak Krishnan requested to join ECE-A 2023-2027.',
    link: '/mentor/classes/class-ece-2024?tab=students',
    read: false,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: 'notif-2',
    user_id: 'student-ece-1',
    title: 'Mentor Feedback Received',
    message: 'Dr. A. Ramanathan left feedback on your post "Implemented TinyML Quantized CNN Model".',
    link: '/student/feed',
    read: false,
    created_at: new Date(Date.now() - 18 * 3600000).toISOString()
  }
];
