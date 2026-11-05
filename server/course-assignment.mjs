export function resolveCourseAssignment(source, suggestion, courses) {
  if (source.course_assignment?.status === '手动指定') {
    return { course_id: source.course_id, course_assignment: source.course_assignment }
  }
  const courseId = suggestion?.course_id
  const match = Number.isInteger(courseId) && courses.find((course) => course.id === courseId)
  if (match && suggestion?.course_confidence === 'high') {
    return { course_id: match.id, course_assignment: { status: '自动匹配' } }
  }
  return { course_id: source.course_id, course_assignment: { status: '保留原课程' } }
}
