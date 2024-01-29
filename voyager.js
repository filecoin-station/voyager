import opentelemetry from './vendor/opentelemetry/api/out.js'
import { BasicTracerProvider } from './vendor/opentelemetry/sdk-trace-base/out.js'
import { extractVerifiedContent } from './vendor/saturn-js-client/dist/strn.min.js'
import { ActivityState } from './lib/activity-state.js'
import { cids as gatewayCids } from './lib/ipfs-gateway-cids.js'

const retrievalClientId = self.crypto.randomUUID()
const activityState = new ActivityState()

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

new BasicTracerProvider().register()

export async function runSaturnBenchmarkInterval() {
    const random = Math.random()
    try {
        if (random <= prodOpts.sampleRate) {
            console.log('Running prod benchmark...')
            await runBenchmark(prodOpts)
            Zinnia.jobCompleted()
        }
        if (random <= testOpts.sampleRate) {
            console.log('Running test benchmark...')
            await runBenchmark(testOpts)
            Zinnia.jobCompleted()
        }
        activityState.onHealthy()
    } catch (err) {
        console.error(err)
        activityState.onError()
    } finally {
        console.log('Sleeping for 60s...')
        setTimeout(runSaturnBenchmarkInterval, 1000 * 60)
    }
}

export async function runBenchmark(opts) {
    const { cid, cidPath } = getWeightedRandomCid(gatewayCids)
    console.log(`Testing ${cid}${cidPath}...`)
    const format = 'car'
    const res = await benchmarkSaturn(opts, cid, cidPath, format)
    await reportBandwidthLogs(opts, [res])
}

function benchmarkSaturn(opts, cid, cidPath, format) {
    const saturnUrl = new URL(opts.saturnOrigin + cidPath)
    saturnUrl.searchParams.set('clientId', retrievalClientId)
    return benchmark('saturn', saturnUrl, cid, format)
}

async function benchmark(service, url, cid, format = null) {
    if (format) {
        url.searchParams.set('format', format)
        if (format === 'car') {
            url.searchParams.set('dag-scope', 'entity')
        }
    }

    url.searchParams.delete('filename')

    const bm = {
        service,
        cid,
        url,
        transferId: null,
        httpStatusCode: null,
        httpProtocol: null,
        nodeId: null,
        cacheStatus: null,
        ttfb: null,
        ttfbAfterDnsMs: null,
        dnsTimeMs: null,
        startTime: new Date(),
        endTime: null,
        transferSize: null,
        ifError: null,
        isDir: null,
        traceparent: null,
    }

    try {
        const opts = {
            cache: 'no-store',
            headers: {},
            signal: AbortSignal.timeout(60_000)
        }

        const res = await fetch(url, opts)

        const { headers } = res

        bm.httpStatusCode = res.status
        bm.cacheStatus = headers.get('saturn-cache-status') ?? headers.get('x-proxy-cache')
        bm.nodeId = headers.get('saturn-node-id') ?? headers.get('x-ipfs-pop')
        bm.transferId = headers.get('saturn-transfer-id') ?? headers.get('x-bfid')
        bm.httpProtocol = headers.get('quic-status')
        bm.transferSize = 0
        bm.ttfb = new Date()

        if (bm.transferId?.length === 32) {
            bm.traceparent = createTraceParent(bm.transferId)
        }

        if (format === 'car') {
            await readCARResponse(res, bm)
        } else {
            await readFlatFileResponse(res, bm)
        }
    } catch (err) {
        console.error(err)
        bm.ifError = err.message
    } finally {
        bm.endTime = new Date()
    }

    if (window.performance) {
        const entry = performance.getEntriesByType('resource')
            .find(r => r.name === url.href)
        if (entry) {
            const dnsStart = entry.domainLookupStart
            const dnsEnd = entry.domainLookupEnd
            const hasData = dnsEnd > 0 && dnsStart > 0
            if (hasData) {
                bm.dnsTimeMs = Math.round(dnsEnd - dnsStart)
                bm.ttfbAfterDnsMs = Math.round(entry.responseStart - entry.requestStart)
            }

            if (bm.httpProtocol === null && entry.nextHopProtocol) {
                bm.httpProtocol = entry.nextHopProtocol
            }
            // else response didn't have Timing-Allow-Origin: *
            //
            // if both dnsStart and dnsEnd are > 0 but have the same value,
            // its a dns cache hit.

            bm.isFromBrowserCache = (
                entry.deliveryType === 'cache' ||
                (bm.httpStatusCode && entry.transferSize === 0)
            )
        }
    }

    return bm
}

async function readFlatFileResponse(res, bm) {
    const isHTML = res.headers.get('content-type') === 'text/html'
    const buffers = []

    for await (const chunk of browserReadableStreamToIt(res.body)) {
        if (!bm.ttfb) {
            bm.ttfb = new Date()
        }
        bm.transferSize += chunk.length

        if (isHTML) {
            buffers.push(chunk)
        }

        if (bm.transferSize > maxDownloadSize) {
            break
        }
    }

    if (isHTML) {
        const text = await (new Blob(buffers)).text()

        const str1 = 'A directory of content-addressed files hosted on IPFS'
        const str2 = 'A directory of files hosted on the distributed, decentralized web using IPFS'
        bm.isDir = text.includes(str1) || text.includes(str2)
    } else {
        bm.isDir = false
    }
}

async function readCARResponse(res, bm) {
    async function* metricsStream(stream) {
        for await (const chunk of browserReadableStreamToIt(stream)) {
            bm.transferSize += chunk.length

            if (bm.transferSize > maxDownloadSize) {
                break
            }
            yield chunk
        }
    }
    const cidPath = (new URL(res.url)).pathname.replace('/ipfs/', '')
    const itr = metricsStream(res.body)

    try {
        for await (const _ of extractVerifiedContent(cidPath, itr)) { }
    } catch (err) {
        bm.verificationError = err.message
    }
}

function createTraceParent(traceId) {
    const span = opentelemetry.trace.getTracer('default').startSpan('request')

    const version = '00'
    const { spanId } = span.spanContext()
    const traceFlag = '01'

    const traceParent = `${version}-${traceId}-${spanId}-${traceFlag}`
    return traceParent
}

// Emulates the log that a retrieval client would send.
function createBandwidthLog(bm) {
    return {
        nodeId: bm.nodeId,
        cacheHit: bm.cacheStatus === 'HIT',
        url: bm.url,
        startTime: bm.startTime,
        numBytesSent: bm.transferSize,
        range: null,
        requestDurationSec: (bm.endTime - bm.startTime) / 1000,
        requestId: bm.transferId,
        httpStatusCode: bm.httpStatusCode,
        httpProtocol: bm.httpProtocol,
        error: bm.ifError ?? bm.verificationError,
        ttfbMs: bm.ttfb ? (bm.ttfb - bm.startTime) : null
    }
}

async function reportBandwidthLogs(opts, benchmarks) {
    const bandwidthLogs = benchmarks
        .filter(bm => bm.service === 'saturn' && !bm.isFromBrowserCache)
        .map(createBandwidthLog)
    console.log('Reporting bandwidth logs...')
    console.log(bandwidthLogs)

    if (bandwidthLogs.length) {
        await fetch(opts.logIngestorUrl, {
            method: 'POST',
            body: JSON.stringify({ bandwidthLogs, logSender: 'voyager' }),
        })
    }

    console.log('Bandwidth logs submitted')
}

function getWeightedRandomCid(cids) {
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

// https://github.com/achingbrain/it/blob/master/packages/browser-readablestream-to-it/index.js
async function* browserReadableStreamToIt(stream, options = {}) {
    const reader = stream.getReader()

    try {
        while (true) {
            const result = await reader.read()
            if (result.done) {
                return
            }
            yield result.value
        }
    } finally {
        if (options.preventCancel !== true) {
            reader.cancel()
        }

        reader.releaseLock()
    }
}
