import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock3, FileText, FolderOpen,
  ExternalLink, Image, Inbox, Link, LoaderCircle, PanelLeft, Plus, RotateCcw, ScanText, Search, Sparkles, Trash2, UploadCloud, X,
} from 'lucide-react'
import { api, Course, ItemStatus, Source } from './api'

type View = 'inbox' | 'courses' | 'review' | 'search'
type Filter = '全部' | ItemStatus

const navigation: { id: View; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: '收件箱', icon: Inbox },
  { id: 'courses', label: '课程库', icon: BookOpen },
  { id: 'review', label: '每日回顾', icon: Clock3 },
  { id: 'search', label: '搜索', icon: Search },
]

function fileIcon(type: Source['type']) {
  if (type === '图片') return <Image size={20} />
  if (type === '网页') return <Link size={20} />
  return <FileText size={20} />
}

function statusIcon(status: ItemStatus) {
  if (status === '已归档') return <CheckCircle2 size={16} />
  if (status === '待确认') return <Sparkles size={16} />
  return <Clock3 size={16} />
}

function formattedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function App() {
  const [courses, setCourses] = useState<Course[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [view, setView] = useState<View>('inbox')
  const [selectedFilter, setSelectedFilter] = useState<Filter>('全部')
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [isDropActive, setDropActive] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [savingCourseId, setSavingCourseId] = useState<number | null>(null)
  const [isCourseDialogOpen, setCourseDialogOpen] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadData = async (showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      const [nextCourses, nextSources] = await Promise.all([api.getCourses(), api.getSources()])
      setCourses(nextCourses)
      setSources(nextSources)
      setError('')
      setSelectedCourseId((current) => current && !nextCourses.some((course) => course.id === current) ? null : current)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法连接到本地服务。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData(true) }, [])
  useEffect(() => {
    if (!sources.some((source) => source.status === '处理中')) return
    const timer = window.setInterval(() => { void loadData() }, 1200)
    return () => window.clearInterval(timer)
  }, [sources])

  const activeCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0]
  const visibleSources = useMemo(() => sources.filter((source) => {
    const statusMatches = selectedFilter === '全部' || source.status === selectedFilter
    const courseMatches = selectedCourseId === null || source.course_id === selectedCourseId
    const searched = `${source.title} ${source.description} ${source.course}`.toLowerCase().includes(searchTerm.trim().toLowerCase())
    return statusMatches && courseMatches && searched
  }), [sources, selectedCourseId, selectedFilter, searchTerm])

  const counts = {
    all: sources.length,
    processing: sources.filter((source) => source.status === '处理中').length,
    review: sources.filter((source) => source.status === '待确认').length,
    archived: sources.filter((source) => source.status === '已归档').length,
  }

  const addFiles = async (fileList: FileList | File[]) => {
    if (!activeCourse) { setError('请先创建一门课程。'); return }
    const files = Array.from(fileList)
    if (!files.length) return
    setUploading(true)
    try {
      await api.upload(files, activeCourse.id)
      await loadData()
      setNotice(`已保存 ${files.length} 份资料，归入“${activeCourse.name}”。`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '文件上传失败。')
    } finally { setUploading(false) }
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDropActive(false)
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files)
  }
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) void addFiles(event.target.files)
    event.target.value = ''
  }
  const saveLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeCourse || !linkValue.trim()) return
    const url = linkValue.trim().match(/^https?:\/\//i) ? linkValue.trim() : `https://${linkValue.trim()}`
    setUploading(true)
    try {
      await api.addLink(url, activeCourse.id)
      setLinkValue(''); await loadData(); setNotice('链接已保存到收件箱。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '链接保存失败。')
    } finally { setUploading(false) }
  }
  const archive = async (id: number) => {
    try { await api.archive(id); await loadData(); setNotice('已确认归档，资料现已进入课程库。') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '归档失败。') }
  }
  const remove = async (id: number) => {
    if (!window.confirm('确定删除这份资料吗？原文件也会从本机移除。')) return
    try { await api.remove(id); await loadData(); setNotice('资料已删除。') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '删除失败。') }
  }
  const createCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!courseName.trim()) return
    try {
      const course = await api.createCourse(courseName)
      await loadData(); setSelectedCourseId(course.id); setCourseName(''); setCourseDialogOpen(false)
      setNotice(`已创建课程“${course.name}”。`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '创建课程失败。') }
  }
  const openSource = (source: Source) => {
    const target = source.source_url || (source.file_url ? api.assetUrl(source.file_url) : null)
    if (target) window.open(target, '_blank', 'noopener,noreferrer')
  }
  const reprocess = async (id: number) => {
    try { await api.reprocess(id); setSelectedSource(null); await loadData(); setNotice('已重新加入解析队列。') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '重新解析失败。') }
  }
  const changeSourceCourse = async (id: number, courseId: number) => {
    setSavingCourseId(id)
    try {
      const updated = await api.setCourse(id, courseId)
      setSelectedSource((current) => current?.id === id ? updated : current)
      await loadData(); setNotice('课程归属已手动更新，重新解析时会保留。')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '更新课程归属失败。') }
    finally { setSavingCourseId(null) }
  }

  const date = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())
  const headline = view === 'inbox' ? '把今天的碎片放进来' : view === 'courses' ? '从课程脉络继续学习' : view === 'review' ? '回看今天留下的线索' : '在你的资料里找答案'
  const subtitle = view === 'inbox' ? '先收集，无需决定放在哪里。资料会保存在本机，并进入你的课程库和每日回顾。' : view === 'courses' ? '每个课程下面都是你确认过的材料，点击资料可打开原文件或原网页。' : view === 'review' ? '这里聚合了已归档的资料，帮助你在零碎时间里快速复盘。' : '搜索标题、课程和资料说明；结果会随着输入即时更新。'
  const displaySources = visibleSources.filter((source) => view !== 'review' || source.status === '已归档')

  return <div className="app-shell">
    <aside className="sidebar" aria-label="主导航">
      <div className="brand"><span className="brand-mark">碎</span><span>碎时重启</span></div>
      <nav>{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} type="button" onClick={() => { setView(id); if (id !== 'courses') setSelectedCourseId(null) }}><Icon size={19} />{label}{id === 'inbox' ? <span>{counts.all}</span> : null}</button>)}</nav>
      <div className="course-group"><div className="sidebar-label">我的课程<button type="button" onClick={() => setCourseDialogOpen(true)} aria-label="添加课程"><Plus size={16} /></button></div>
        {courses.slice(0, 5).map((course) => <button className={`course-link ${selectedCourseId === course.id ? 'selected-course' : ''}`} key={course.id} type="button" onClick={() => { setView('courses'); setSelectedCourseId(course.id) }}><span className="course-dot" />{course.name}<small>{course.source_count}</small></button>)}
      </div><div className="sidebar-tip"><Sparkles size={17} /><p>本地优先保存。<br />来源文件一直可追溯。</p></div>
    </aside>
    <main>
      <header className="topbar"><button className="mobile-menu" type="button" aria-label="打开导航"><PanelLeft size={21} /></button><div className="breadcrumb">{navigation.find((item) => item.id === view)?.label}<span>/</span>{view === 'inbox' ? '今日' : '资料空间'}</div><div className="connection"><span className={error ? 'offline' : 'online'} />{error ? '服务未连接' : '本地已连接'}</div><button className="profile" type="button" aria-label="个人菜单">罗</button></header>
      <section className="content" aria-labelledby="page-title">
        <div className="heading-row"><div><p className="eyebrow">{date}</p><h1 id="page-title">{headline}</h1><p className="subtitle">{subtitle}</p></div><div className="today-stat"><span>{view === 'review' ? '已归档' : '已收集'}</span><strong>{view === 'review' ? counts.archived : counts.all}</strong><small>份内容</small></div></div>
        {view === 'inbox' && <div className="capture-grid">
          <div className={`dropzone ${isDropActive ? 'drag-active' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDropActive(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDropActive(false)} onDrop={onDrop} role="button" tabIndex={0} aria-label="拖拽或选择文件上传" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}>
            <div className="upload-icon"><UploadCloud size={25} /></div><h2>{uploading ? '正在保存资料…' : '拖入资料，或选择文件'}</h2><p>支持图片、PDF、PPT、Word 和文本文件，单个文件不超过 30MB。</p>
            <div className="upload-controls"><button className="primary-button" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}><Plus size={18} />选择文件</button><label className="course-select">归入<select value={activeCourse?.id ?? ''} onChange={(event) => setSelectedCourseId(Number(event.target.value))} aria-label="选择归入课程">{courses.map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}</select><ChevronDown size={15} /></label></div>
            <input ref={inputRef} onChange={onFileChange} type="file" accept="image/*,.pdf,.ppt,.pptx,.doc,.docx,.txt,.md" multiple hidden />
          </div>
          <form className="link-card" onSubmit={saveLink}><div className="link-icon"><Link size={21} /></div><div><h2>保存一条链接</h2><p>自动抓取网页标题、正文和封面图，再整理成学习笔记。</p></div><label className="sr-only" htmlFor="url">网页链接</label><input id="url" value={linkValue} disabled={uploading} onChange={(event) => setLinkValue(event.target.value)} placeholder="粘贴网页链接" inputMode="url" /><button className="text-button" disabled={uploading} type="submit">开始抓取 <ArrowRight size={16} /></button></form>
        </div>}
        {(notice || error) && <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>{error ? <X size={18} /> : <CheckCircle2 size={18} />}{error || notice}<button type="button" onClick={() => { setNotice(''); setError('') }} aria-label="关闭提示">×</button></div>}
        {view === 'search' && <div className="search-panel"><Search size={19} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="输入标题、课程或资料说明" autoFocus /></div>}
        {view === 'courses' && <div className="course-tabs"><button className={selectedCourseId === null ? 'selected' : ''} onClick={() => setSelectedCourseId(null)} type="button">全部课程</button>{courses.map((course) => <button className={selectedCourseId === course.id ? 'selected' : ''} onClick={() => setSelectedCourseId(course.id)} key={course.id} type="button">{course.name}<span>{course.source_count}</span></button>)}</div>}
        <section className="inbox-section" aria-labelledby="inbox-title"><div className="section-header"><div><h2 id="inbox-title">{view === 'courses' ? selectedCourseId ? activeCourse?.name : '课程资料' : view === 'review' ? '今日回顾' : view === 'search' ? '搜索结果' : '收件箱'}</h2><p>{loading ? '正在读取本机资料库…' : view === 'review' ? `你已确认 ${counts.archived} 份可复习资料。` : '点击资料标题可打开原文件或原网页。'}</p></div><button className="icon-button" onClick={() => void loadData(true)} type="button" aria-label="刷新资料列表"><LoaderCircle className={loading ? 'spin' : ''} size={19} /></button></div>
          {view === 'inbox' && <div className="filters" role="tablist" aria-label="按状态筛选">{(['全部', '处理中', '待确认', '已归档'] as Filter[]).map((filter) => <button key={filter} type="button" className={selectedFilter === filter ? 'selected' : ''} onClick={() => setSelectedFilter(filter)} role="tab" aria-selected={selectedFilter === filter}>{filter}{filter === '处理中' && counts.processing > 0 ? <span>{counts.processing}</span> : null}{filter === '待确认' && counts.review > 0 ? <span>{counts.review}</span> : null}</button>)}</div>}
          <div className="inbox-list">{displaySources.map((source) => <article className="inbox-item" key={source.id}>
            <button className={`file-thumb ${source.type}`} onClick={() => openSource(source)} type="button" aria-label={`打开原始资料：${source.title}`}>{fileIcon(source.type)}</button>
            <div className="item-copy"><div className="item-heading"><button className="source-title" type="button" onClick={() => setSelectedSource(source)}>{source.title}</button><span className={`status status-${source.status}`}>{statusIcon(source.status)}{source.status}</span>{source.extraction?.status === '失败' && <span className="parse-state parse-failed">解析失败</span>}{source.extraction?.status === '已完成' && <span className="parse-state"><ScanText size={14} />已提取</span>}{source.analysis?.status === '已完成' && <span className="parse-state ai-complete"><Sparkles size={14} />AI 已整理</span>}</div><p>{source.description}</p><div className="item-meta"><span><FolderOpen size={14} />{source.course}</span><span>{formattedDate(source.updated_at)}</span></div>{source.progress !== null ? <div className="progress" aria-label={`处理进度 ${source.progress}%`}><span style={{ width: `${source.progress}%` }} /></div> : null}</div>
            <div className="row-actions">{source.status === '待确认' && <button className="review-button" type="button" onClick={() => void archive(source.id)}>确认归档</button>}{source.status !== '处理中' && (source.file_url || source.source_url) && <button className="row-more" type="button" onClick={() => void reprocess(source.id)} aria-label={`重新解析 ${source.title}`} title="重新解析"><RotateCcw size={18} /></button>}<button className="row-more" type="button" onClick={() => void remove(source.id)} aria-label={`删除 ${source.title}`}><Trash2 size={18} /></button></div>
            {source.status !== '处理中' && <div className="source-course-control">
              <label htmlFor={`source-course-${source.id}`}>课程归属</label>
              <select id={`source-course-${source.id}`} value={source.course_id ?? ''} disabled={savingCourseId === source.id} onChange={(event) => void changeSourceCourse(source.id, Number(event.target.value))}>
                {source.course_id === null && <option value="" disabled>未分类</option>}
                {courses.map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}
              </select>
              <span>{source.course_id === null ? '可手动选择课程' : source.course_assignment?.status === '自动匹配' ? 'AI 自动匹配' : source.course_assignment?.status === '手动指定' ? '已手动指定' : source.course_assignment?.status === '保留原课程' ? '未找到明确匹配，保留原课程' : '原课程'}</span>
            </div>}
          </article>)}
          {!loading && displaySources.length === 0 && <div className="empty-state"><Inbox size={28} /><h3>这里暂时没有内容</h3><p>{view === 'inbox' ? '上传一份资料，或保存一条链接开始使用。' : '换一个课程或筛选条件看看。'}</p></div>}</div>
        </section>
      </section>
    </main>
    {selectedSource && <div className="dialog-backdrop" role="presentation"><section className="dialog extraction-dialog" aria-labelledby="extraction-dialog-title"><button className="dialog-close" type="button" onClick={() => setSelectedSource(null)} aria-label="关闭解析内容"><X size={18} /></button><p className="dialog-kicker"><ScanText size={15} />内容提取</p><h2 id="extraction-dialog-title">{selectedSource.title}</h2>{selectedSource.cover_url && <img className="web-cover" src={selectedSource.cover_url} alt="网页封面" referrerPolicy="no-referrer" /> }<p>{selectedSource.extraction?.status === '已完成' ? `${selectedSource.extraction.parser ?? '本地解析器'} · ${selectedSource.extraction.char_count.toLocaleString('zh-CN')} 字${selectedSource.extraction.page_count ? ` · ${selectedSource.extraction.page_count} 页` : ''}` : selectedSource.extraction?.error ?? '这份资料暂时没有可读取的文本。'}</p>{selectedSource.analysis?.status === '已完成' && <section className="ai-note" aria-labelledby="ai-note-title"><div className="ai-note-heading"><Sparkles size={17} /><h3 id="ai-note-title">AI 学习笔记</h3><span>{selectedSource.analysis.model}</span></div><p className="ai-summary">{selectedSource.analysis.summary}</p><div className="ai-grid"><div><h4>大纲</h4><ol>{selectedSource.analysis.outline.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol></div><div><h4>知识点</h4><ul className="key-point-list">{selectedSource.analysis.key_points.map((point, index) => <li key={`${point.title}-${index}`}><strong>{point.title}</strong><span>{point.explanation}</span><em>来源：{point.source_excerpt}</em></li>)}</ul></div></div><div className="ai-tags">{selectedSource.analysis.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{selectedSource.analysis.study_question && <p className="study-question"><strong>复习问题：</strong>{selectedSource.analysis.study_question}</p>}</section>}{selectedSource.analysis?.status === '生成中' && <div className="analysis-pending"><LoaderCircle className="spin" size={18} />已完成文本提取，正在生成学习笔记…</div>}{selectedSource.analysis?.status === '失败' && <div className="analysis-pending analysis-error">AI 整理未完成：{selectedSource.analysis.error}</div>}{selectedSource.extraction?.status === '已完成' ? <details className="raw-text"><summary>查看提取原文</summary><pre className="extraction-text">{selectedSource.extraction.text}</pre></details> : <div className="extraction-empty"><ScanText size={24} /><strong>{selectedSource.extraction?.status === '解析中' ? '正在提取内容' : '暂无可查看内容'}</strong><span>原始资料始终可打开；解析失败时可重新尝试。</span></div>}<div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => openSource(selectedSource)}><ExternalLink size={16} />打开原始资料</button>{selectedSource.extraction?.status === '失败' && (selectedSource.file_url || selectedSource.source_url) && <button className="primary-button" type="button" onClick={() => void reprocess(selectedSource.id)}><RotateCcw size={16} />重新解析</button>}</div></section></div>}
    {isCourseDialogOpen && <div className="dialog-backdrop" role="presentation"><form className="dialog" onSubmit={createCourse} aria-labelledby="course-dialog-title"><button className="dialog-close" type="button" onClick={() => setCourseDialogOpen(false)} aria-label="关闭"><X size={18} /></button><h2 id="course-dialog-title">新建课程</h2><p>课程是你整理碎片的基础分类。</p><label htmlFor="course-name">课程名称</label><input id="course-name" value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="例如：认知心理学" autoFocus maxLength={50} /><div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setCourseDialogOpen(false)}>取消</button><button type="submit" className="primary-button">创建课程</button></div></form></div>}
  </div>
}
