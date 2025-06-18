'use strict'

require('dotenv').config()

const http = require('http')
const axios = require('axios')
const he = require('he')

/* args */

const serverPort = process.env.SERVER_PORT
const ankiPort = process.env.ANKI_PORT
const proxyPort = process.env.PROXY_PORT

/* proxy */

const server = http.createServer((req, res) => {
	let body = ''
	req.on('data', chunk => {
		body += chunk
	})

	req.on('end', async () => {
		try {
			const headers = { ...req.headers }

			const data = body ? JSON.parse(body) : undefined

			const urlHtml = data?.params?.note?.fields?.Url
			const hrefMatch = urlHtml?.match(/href="([^"]+)"/)
			const actualUrl = hrefMatch ? he.decode(hrefMatch[1]) : undefined

			console.log(`Proxy: received ${JSON.stringify(data?.action === 'multi' ? data?.params?.actions : data?.action)}`, data, urlHtml, actualUrl)

			if (req.method === 'POST'
				&& req.url === '/'
				&& (data?.action === 'addNote' || data?.action === 'updateNoteFields')
				&& actualUrl) {
				console.log('\n-----------------------')
				console.log('Proxy: Request from video-player client:', body)
				try {
					const params = new URLSearchParams(actualUrl.split('?')[1])
					console.log(actualUrl)
					console.log(params)
					console.log('-----------------------\n')
					const clipResponse = await axios.post(`http://127.0.0.1:${serverPort}/clip`, {
						base: params.get('currentBase'),
						startTime: Number(params.get('currentStartTime')),
						endTime: Number(params.get('currentEndTime'))
					})

					console.log('Proxy: Clip request successful:', clipResponse.data)
				} catch (clipError) {
					console.error('Proxy: Error during clip request:', clipError)
				}
			}

			const axiosConfig = {
				method: req.method,
				url: `http://127.0.0.1:${ankiPort}${req.url}`,
				headers: headers,
				data,
				responseType: 'stream'
			}

			const response = await axios(axiosConfig)

			res.writeHead(response.status, response.headers)

			response.data.pipe(res)

			response.data.on('error', (err) => {
				console.error('Proxy: Error while streaming response:', err)
				res.statusCode = 500
				res.end('Internal Server Error')
			})

			res.on('error', (err) => {
				console.error('Proxy: Error during response to client:', err)
			})

		} catch (error) {
			console.error('Proxy: Error forwarding request:', error)
			if (!res.headersSent) {
				res.statusCode = 500
				res.end('Internal Server Error')
			}
		}
	})

	req.on('error', err => {
		console.error('Proxy: Request error:', err)
	})
})

/* main */

server.listen(proxyPort, '127.0.0.1', () => {
	console.log(`Proxy: running at http://127.0.0.1:${proxyPort}`)
})
