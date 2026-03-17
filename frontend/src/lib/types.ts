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
  author_user_id?: string | null;
  author_username?: string | null;
  author_is_admin?: boolean;
  author_tags?: string[];
  post_number: number;
  created_at: string;
  body: string;
  media_type?: 'image' | 'video' | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: number | null;
  media_width?: number | null;
  media_height?: number | null;
  media_duration_sec?: number | null;
  image_url?: string | null;
  image_mime_type?: string | null;
  image_size_bytes?: number | null;
  image_width?: number | null;
  image_height?: number | null;
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