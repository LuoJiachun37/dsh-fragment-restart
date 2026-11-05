export class WebPageError extends Error {
  constructor(code, message) { super(message); this.name = 'WebPageError'; this.code = code }
}

export function httpStatusError(status) {
  if (status === 401) return new WebPageError('login_required', '网站要求登录或身份验证。请在浏览器打开原网页，或上传你有权使用的内容。')
  if (status === 402) return new WebPageError('payment_required', '网站要求付费后访问。请在浏览器确认访问权限，或上传你有权使用的内容。')
  if (status === 403) return new WebPageError('access_denied', '网站拒绝访问（HTTP 403），可能限制自动抓取或要求登录。请在浏览器打开原网页确认。')
  if (status === 404 || status === 410) return new WebPageError('not_found', `网页不存在或已移除（HTTP ${status}）。请检查链接是否正确。`)
  if (status === 429) return new WebPageError('rate_limited', '网站暂时限制访问频率（HTTP 429）。请稍后再试。')
  if (status >= 500) return new WebPageError('site_unavailable', `目标网站暂时不可用（HTTP ${status}）。请稍后再试。`)
  return new WebPageError('http_error', `网站返回 HTTP ${status}，无法读取正文。请在浏览器检查原网页。`)
}

export function networkError(error) {
  const code = error?.cause?.code ?? error?.code
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || code === 'UND_ERR_CONNECT_TIMEOUT') return new WebPageError('timeout', '访问网页超时。请检查网络连接，或稍后重试。')
  if (typeof code === 'string' && /^(CERT_|ERR_TLS|DEPTH_ZERO|UNABLE_TO_VERIFY|SELF_SIGNED)/.test(code)) return new WebPageError('tls_error', '无法验证网站的安全证书。请在浏览器检查该网站，不要忽略证书警告。')
  return new WebPageError('network_error', '无法连接该网站。请检查网络和链接，或在浏览器确认网站是否可访问。')
}

function containsRestrictedMetadata(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 12) return false
  if (value.isAccessibleForFree === false || value.isAccessibleForFree === 'False' || value.isAccessibleForFree === 'false') return true
  return Object.values(value).some((child) => containsRestrictedMetadata(child, depth + 1))
}

export function detectRestrictedPage($, finalUrl) {
  let restrictedMetadata = false
  $('script[type="application/ld+json"]').each((_, element) => {
    try { if (containsRestrictedMetadata(JSON.parse($(element).text()))) restrictedMetadata = true } catch { /* Ignore malformed metadata. */ }
  })
  if (restrictedMetadata) return new WebPageError('paywall_detected', '网页标记为付费或受限内容，公开内容可能不完整，未生成摘要。请打开原网页确认权限，或上传你有权使用的完整内容。')

  const paywallPattern = /subscribe to (?:continue|read|access)|subscription (?:is )?required|subscribers? only|sign up to continue reading|订阅后(?:继续)?阅读|付费后(?:继续)?阅读|购买后(?:继续)?阅读|会员专享|会员才能阅读/i
  const loginPattern = /(?:sign in|log in) to (?:continue|read|access)|登录后(?:继续)?(?:阅读|查看)|请先登录后(?:阅读|查看)/i
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const restrictedText = $('[class*="paywall" i], [id*="paywall" i], [class*="subscriber-only" i], [id*="subscriber-only" i]').text().replace(/\s+/g, ' ').trim()
  if (paywallPattern.test(restrictedText) || (bodyText.length < 2500 && paywallPattern.test(bodyText))) return new WebPageError('paywall_detected', '网页疑似需要订阅或付费，公开内容可能不完整，未生成摘要。请打开原网页确认权限，或上传你有权使用的完整内容。')
  let loginPath = false
  try { loginPath = /\/(?:login|log-in|signin|sign-in)(?:\/|$)/i.test(new URL(finalUrl).pathname) } catch { /* URL validation happens elsewhere. */ }
  if ((loginPath && $('input[type="password"]').length > 0) || (bodyText.length < 2500 && loginPattern.test(bodyText))) return new WebPageError('login_required', '网页疑似需要登录才能阅读。请在浏览器打开原网页，或上传你有权使用的内容；应用暂不支持代登录。')
  return null
}
