import { BasicTracerProvider } from './vendor/opentelemetry/sdk-trace-base/out.js'
import { Saturn, indexedDbStorage } from './vendor/saturn-js-client/dist/strn.js'
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

const prodSaturn = new Saturn({
    cdnURL: prodOpts.saturnOrigin,
    logURL: prodOpts.logIngestorUrl,
    authURL: 'https://su4hesnyinnwvtk3h2rkauh5ja0qrisq.lambda-url.us-west-2.on.aws/',
    storage: indexedDbStorage(),
    logSender: 'voyager',
    experimental: true,
    clientKey: 'c11dbbe1-a007-4e59-86d5-fc67dc8f317c'
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
})

new BasicTracerProvider().register()
Zinnia.activity.info('Voyager benchmarking started')

export async function runSaturnBenchmarkInterval() {
    let runningOnSaturnNode = false
    try {
        runningOnSaturnNode = await isRunningOnSaturnNode()
    } catch (err) {
        console.error(
            'Could not check if running on Saturn node',
            { cause: err }
        )
    }
    if (runningOnSaturnNode) {
        console.log('Running on Saturn host, skipping benchmark')
    } else {
        await runSaturnBenchmark()
    }
    // console.log('Sleeping for 1s...')
    // setTimeout(runSaturnBenchmarkInterval, 1000)
}

async function runSaturnBenchmark() {
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
    const res = await fetch('https://voyager.filstation.app/inspect-request')
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

export async function runBenchmark(saturn) {
    const { cidPath } = getWeightedRandomCid(gatewayCids)
    console.log(`Testing ${cidPath}...`)
    return sendSaturnRequest(saturn, cidPath)
}

async function sendSaturnRequest(saturn, cidPath) {
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