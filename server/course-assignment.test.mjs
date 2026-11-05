import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveCourseAssignment } from './course-assignment.mjs'

const courses = [{ id: 1, name: '概率论' }, { id: 2, name: '高等数学' }]
const source = { course_id: 1 }

test('only a high-confidence existing course is applied', () => {
  assert.deepEqual(resolveCourseAssignment(source, { course_id: 2, course_confidence: 'high' }, courses), { course_id: 2, course_assignment: { status: '自动匹配' } })
  for (const suggestion of [{ course_id: 2, course_confidence: 'medium' }, { course_id: 99, course_confidence: 'high' }, { course_id: '2', course_confidence: 'high' }, null]) {
    assert.deepEqual(resolveCourseAssignment(source, suggestion, courses), { course_id: 1, course_assignment: { status: '保留原课程' } })
  }
})

test('manual assignment survives subsequent AI suggestions', () => {
  const manual = { course_id: 1, course_assignment: { status: '手动指定' } }
  assert.deepEqual(resolveCourseAssignment(manual, { course_id: 2, course_confidence: 'high' }, courses), manual)
})
