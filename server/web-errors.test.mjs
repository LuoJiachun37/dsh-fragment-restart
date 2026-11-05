import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { httpStatusError, networkError, detectRestrictedPage } from './web-errors.mjs'

const require = createRequire(new URL('../app/package.json', import.meta.url))
const { load } = require('cheerio')

test('HTTP failures receive specific actionable messages', () => {
  for (const [status, code] of [[401, 'login_required'], [402, 'payment_required'], [403, 'access_denied'], [404, 'not_found'], [410, 'not_found'], [429, 'rate_limited'], [503, 'site_unavailable']]) {
    const result = httpStatusError(status)
    assert.equal(result.code, code)
    assert.ok(result.message.length > 10)
  }
})

test('network and timeout failures remain distinct', () => {
  assert.equal(networkError({ name: 'TimeoutError' }).code, 'timeout')
  assert.equal(networkError({ cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }).code, 'timeout')
  assert.equal(networkError({ cause: { code: 'CERT_HAS_EXPIRED' } }).code, 'tls_error')
  assert.equal(networkError(new Error('failed')).code, 'network_error')
})

test('detects structured paywalls even with a long preview', () => {
  const html = `<html><head><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script></head><body><article><p>${'正文预览。'.repeat(1000)}</p></article></body></html>`
  assert.equal(detectRestrictedPage(load(html), 'https://example.com/article').code, 'paywall_detected')
})

test('detects explicit paywall and login screens but not articles discussing them', () => {
  assert.equal(detectRestrictedPage(load('<div class="paywall">Subscribe to continue reading</div>'), 'https://example.com/a').code, 'paywall_detected')
  assert.equal(detectRestrictedPage(load('<form><input type="password"></form>'), 'https://example.com/login').code, 'login_required')
  assert.equal(detectRestrictedPage(load('<p>登录后阅读完整文章</p>'), 'https://example.com/a').code, 'login_required')
  const publicArticle = `<article><p>${'This article discusses subscription systems and how they work. '.repeat(50)}</p></article>`
  assert.equal(detectRestrictedPage(load(publicArticle), 'https://example.com/a'), null)
})
