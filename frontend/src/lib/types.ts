export type Thread = {
  id: string;
  board_slug: string;
  subject: string | null;
  subject_slug: string;
  token: string;
  created_at: string;
  bumped_at: string;
};

export type Post = {
  id: string;
  thread_id: string;
  post_number: number;
  created_at: string;
  body: string;
};

export type ThreadListResponse = {
  threads: Thread[];
};

export type ThreadDetailResponse = {
  thread: Thread;
  posts: Post[];
};

export type CreateThreadResponse = {
  thread: Thread;
  firstPost: Post;
  canonicalPath: string;
};

export type ReplyResponse = {
  post: Post;
};