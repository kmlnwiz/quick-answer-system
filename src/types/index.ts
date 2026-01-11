export interface Room {
  id: number;
  room_code: string;
  created_at: Date;
  allow_resubmission: boolean;
  total_questions: number;
  is_active: boolean;
  score_table: number[];
}

export interface Team {
  id: number;
  name: string;
  color: string;
  display_order: number;
}

export interface User {
  id: number;
  room_id: number;
  username: string;
  team_id: number;
  joined_at: Date;
  session_token: string;
}

export interface Question {
  id: number;
  room_id: number;
  question_number: number;
  answer_type: 'free_text' | 'multiple_choice';
  choices?: string[];
  correct_answer?: string;
  global_start_time?: Date;
}

export interface QuestionTeamStart {
  id: number;
  question_id: number;
  team_id: number;
  start_time: Date;
}

export interface Answer {
  id: number;
  room_id: number;
  user_id: number;
  question_number: number;
  answer_text: string;
  submitted_at: Date;
  elapsed_time_ms?: number;
  submission_date: Date;
  is_correct?: boolean;
  score: number;
  user?: User & { team?: Team };
}

export interface Comment {
  id: number;
  room_id: number;
  user_id: number;
  comment_text: string;
  created_at: Date;
}

export interface AdminSession {
  id: number;
  session_token: string;
  created_at: Date;
  expires_at: Date;
}
