/* global Zinnia */

import { BasicTracerProvider } from './vendor/opentelemetry/sdk-trace-base/out.js'
import { Saturn, indexedDbStorage } from './vendor/saturn-js-client/dist/strn.min.js'
import { cids as gatewayCids } from './lib/ipfs-gateway-cids.js'

// Example: https://ipfs.io/ipfs/${cid}
const prodSaturnOrigin = 'https://l1s.saturn.ms'
const testSaturnOrigin = 'https://l1s.saturn-test.ms'
// Example: https://strn.pl/ipfs/${cid}?clientId=${this.clientId}
const MEGABYTE = 1024 ** 2
const maxDownloadSize = MEGABYTE * 10

const prodOpts = {
  saturnOrigin: prodSaturnOrigin,
  logIngestorUrl: 'https://25y6y3tobkpa3thvn5wvu6kgsa0wzhdk.lambda-url.us-west-2.on.aws/',
  sampleRate: 1
}
const testOpts = {
  saturnOrigin: testSaturnOrigin,
  logIngestorUrl: 'https://p6wofrb2zgwrf26mcxjpprivie0lshfx.lambda-url.us-west-2.on.aws/',
  sampleRate: 0.01
}

async function assertOkResponse (res, errorMsg) {
  if (res.ok) return

  let body
  try {
    body = await res.text()
  } catch {}
  const err = new Error(`${errorMsg ?? 'Fetch failed'} (${res.status}): ${body}`)
  err.statusCode = res.status
  err.serverMessage = body
  throw err
}

const onReportLogs = async logs => {
  console.log(`Submitting ${logs.length} measurements...`)
  for (const log of logs) {
    const payload = {
      cid: log.url.href.replace(log.url.origin, ''),
      endAt: new Date(log.startTime.getTime() + (log.requestDurationSec * 1000)),
      statusCode: log.httpStatusCode,
      carTooLarge: log.error === 'The signal has been aborted',
      zinniaVersion: Zinnia.versions.zinnia,
      participantAddress: Zinnia.walletAddress
    }
    console.log('%o', payload)
    const res = await fetch('https://voyager.filstation.app/measurements', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10_000)
    })
    try {
      await assertOkResponse(res, 'Failed to submit measurement')
      console.log('Measurement submitted')
    } catch (err) {
      console.error(err)
    }
  }
}

const prodSaturn = new Saturn({
  cdnURL: prodOpts.saturnOrigin,
  logURL: prodOpts.logIngestorUrl,
  authURL: 'https://su4hesnyinnwvtk3h2rkauh5ja0qrisq.lambda-url.us-west-2.on.aws/',
  storage: indexedDbStorage(),
  logSender: 'voyager',
  experimental: true,
  clientKey: 'c11dbbe1-a007-4e59-86d5-fc67dc8f317c',
  onReportLogs
})

// test should use default memory storage so it doesn't overwrite prod storage.
const testSaturn = new Saturn({
  cdnURL: testOpts.saturnOrigin,
  logURL: testOpts.logIngestorUrl,
  authURL: 'https://fz3dyeyxmebszwhuiky7vggmsu0rlkoy.lambda-url.us-west-2.on.aws/',
  orchURL: 'https://orchestrator.strn-test.pl/nodes?maxNodes=100',
  logSender: 'voyager',
  experimental: true,
  clientKey: 'c536c9b9-81a1-4a98-8b05-61341e5dd77e',
  onReportLogs
})

const sleep = dt => new Promise(resolve => setTimeout(resolve, dt))

new BasicTracerProvider().register()
Zinnia.activity.info('Voyager benchmarking started')

export async function runSaturnBenchmarkLoop () {
  while (true) {
    await runSaturnBenchmark()
    console.log('Sleeping for 5000ms...')
    await sleep(5_000)
  }
}

async function runSaturnBenchmark () {
  let runningOnSaturnNode = true
  try {
    runningOnSaturnNode = await isRunningOnSaturnNode()
  } catch (err) {
    console.error(
      'Could not check if running on Saturn node',
      { cause: err.message }
    )
  }
  if (runningOnSaturnNode) {
    console.log('Running on Saturn host, skipping benchmark')
    return
  }

  const random = Math.random()
  if (random <= prodOpts.sampleRate) {
    console.log('Running prod benchmark...')
    try {
      await runBenchmark(prodSaturn)
      console.log('Prod benchmark successful!')
    } catch (err) {
      console.error(err)
    }
    Zinnia.jobCompleted()
  }
  if (random <= testOpts.sampleRate) {
    console.log('Running test benchmark...')
    try {
      await runBenchmark(testSaturn)
      console.log('Test benchmark successful!')
    } catch (err) {
      console.error(err)
    }
    Zinnia.jobCompleted()
  }
}

async function getPublicIPv4Address () {
  // FIXME: Use voyager API
  const res = await fetch('https://api.filspark.com/inspect-request')
  await assertOkResponse(res, 'Failed to get public IP address')
  const { cloudflareAddr: ip } = await res.json()
  return ip
}

async function isRunningOnSaturnNode () {
  const ip = await getPublicIPv4Address()
  const subdomain = ip.replaceAll('.', '-')
  try {
    await fetch(`https://${subdomain}.l1s.saturn.ms/`, {
      redirect: 'manual'
    })
    return true
  } catch {
    return false
  }
}

export async function runBenchmark (saturn) {
  const { cidPath } = getWeightedRandomCid(gatewayCids)
  console.log(`Testing ${cidPath}...`)
  try {
    await sendSaturnRequest(saturn, cidPath)
  } catch (err) {
    if (
      err.message.includes('Non-base58btc character') ||
            err.message.includes('Non-base32 character') ||
            err.message.includes('file does not exist') ||
            err.message.includes('Non OK response received') ||
            err.message.includes('The signal has been aborted') ||
            /received [^ ]+ instead/.test(err.message) ||
            err.message.includes('CAR file has no more blocks')
    ) {
      console.error('Failed to fetch content', { cause: err.message })
      return
    }
    throw err
  }
}

async function sendSaturnRequest (saturn, cidPath) {
  cidPath = cidPath.replace('/ipfs/', '')

  const controller = new AbortController()
  const fetchOpts = {
    cache: 'no-store', // bypass browser cache
    controller,
    firstHitDNS: true
  }

  let numBytes = 0
  const content = saturn.fetchContentWithFallback(cidPath, fetchOpts)

  for await (const chunk of content) {
    numBytes += chunk.length
    if (numBytes > maxDownloadSize) {
      controller.abort()
    }
  }
}

function getWeightedRandomCid (cids) {
  // const items = []
  // const weights = []
  // for (const [cid, weight] of cids) {
  //     items.push(cid)
  //     weights.push(weight)
  // }

  // const { item: cidPath } = weightedRandom(items, weights)

  const [cidPath] = cids[Math.floor(Math.random() * cids.length)]
  const cid = cidPath.split('?')[0]?.split('/')[2]

  return { cid, cidPath }
}
