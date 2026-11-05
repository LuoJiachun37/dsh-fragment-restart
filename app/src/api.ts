export type ItemStatus = '处理中' | '待确认' | '已归档'

export type Course = {
  id: number
  name: string
  source_count: number
  created_at: string
}

export type Source = {
  id: number
  title: string
  description: string
  type: 'PPTX' | 'PDF' | '图片' | '网页' | '文本'
  status: ItemStatus
  course_id: number | null
  course: string
  updated_at: string
  progress: number | null
  file_url: string | null
  source_url: string | null
  cover_url?: string | null
  course_assignment?: { status: '自动匹配' | '保留原课程' | '手动指定' }
  extraction: {
    status: '解析中' | '已完成' | '失败' | '尚未解析'
    parser: string | null
    text: string
    char_count: number
    page_count: number | null
    error: string | null
    completed_at: string | null
  }
  analysis?: {
    status: '等待提取' | '生成中' | '已完成' | '失败' | '未生成'
    model: string | null
    summary: string
    outline: string[]
    key_points: { title: string; explanation: string; source_excerpt: string }[]
    tags: string[]
    study_question: string
    error: string | null
    completed_at: string | null
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options)
  if (!response.ok) {
    let message = '请求失败，请稍后重试。'
    try {
      const body = await response.json() as { detail?: string }
      message = body.detail || message
    } catch { /* Keep the fallback error message. */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  getCourses: () => request<Course[]>('/api/courses'),
  getSources: () => request<Source[]>('/api/sources'),
  createCourse: (name: string) => request<Course>('/api/courses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  }),
  upload: (files: File[], courseId: number) => {
    const form = new FormData()
    form.append('course_id', String(courseId))
    files.forEach((file) => form.append('files', file))
    return request<Source[]>('/api/sources/upload', { method: 'POST', body: form })
  },
  addLink: (url: string, courseId: number) => request<Source>('/api/sources/link', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, course_id: courseId }),
  }),
  archive: (id: number) => request<Source>(`/api/sources/${id}/archive`, { method: 'PATCH' }),
  reprocess: (id: number) => request<Source>(`/api/sources/${id}/reprocess`, { method: 'POST' }),
  setCourse: (id: number, courseId: number) => request<Source>(`/api/sources/${id}/course`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_id: courseId }),
  }),
  remove: (id: number) => request<void>(`/api/sources/${id}`, { method: 'DELETE' }),
  assetUrl: (path: string) => `${API_BASE}${path}`,
}
